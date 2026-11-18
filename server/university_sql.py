"""Evaluate university SQL exercises in a fresh, bounded SQLite database."""

import json
import math
import re
from datetime import datetime
import sqlite3
from collections import Counter
from contextlib import closing
from itertools import groupby
from pathlib import Path

LAB = json.loads(Path(__file__).with_name("university-sql.json").read_text())
EXERCISES = LAB["exercises"]
FUNCTIONS = set("""
    abs avg cast ceil ceiling char coalesce concat concat_ws count date datetime
    format glob group_concat hex ifnull iif instr julianday length like likelihood
    likely lower ltrim max min mod nullif printf quote replace round rtrim sign
    strftime substr substring sum time total trim typeof unicode unixepoch unlikely upper
""".split())
SCHEMA_FUNCTIONS = {"sqlite_rename_table", "sqlite_rename_test", "sqlite_rename_quotefix",
                    "sqlite_rename_column", "sqlite_drop_column"}
READ_ACTIONS = {sqlite3.SQLITE_READ, sqlite3.SQLITE_SELECT, sqlite3.SQLITE_RECURSIVE}
WRITE_ACTIONS = {sqlite3.SQLITE_ALTER_TABLE, sqlite3.SQLITE_CREATE_TABLE, sqlite3.SQLITE_DROP_TABLE,
                 sqlite3.SQLITE_INSERT, sqlite3.SQLITE_UPDATE, sqlite3.SQLITE_DELETE,
                 sqlite3.SQLITE_TRANSACTION, sqlite3.SQLITE_SAVEPOINT}
SORT_KEYS = {17: (2,), 18: (0,), 20: (2,), 23: (1, 2), 24: (1, 2), 37: (0,),
             39: (2,), 45: (1,), 50: (1,), 51: (2,)}
NAMED_COLUMNS = {
    4: (2,), 7: (3,), 8: (0, 1, 2, 3), 10: (0,), 11: (0,), 19: (0, 1),
    35: (3,), 36: (3, 4), 38: (0,), 43: (3, 4), 44: (0, 1), 45: (1,), 49: (2,),
    50: (1,), 51: (2,), 52: (1,), 54: (3,), 70: (0, 1, 2, 3), 71: (0, 1, 2, 3),
    75: (0, 1, 2, 3),
}
REQUIRED_SYNTAX = {
    21: (r"\bLIKE\b", r"\bstrftime\s*\("),
    38: (r"\|\|", r"\bconcat\s*\("),
    39: (r"\bLIKE\b", r"\bsubstr(?:ing)?\s*\("),
}


def catalog():
    return [{"id": key, **{field: ex[field] for field in ("title", "prompt", "group", "hint")},
             "choice": ex.get("choice", False), "write": key.startswith("4-")}
            for key, ex in EXERCISES.items()]


def connection(key, ex, reverse=False):
    data = LAB["fixtures"][key[0]]
    db = sqlite3.connect(":memory:", isolation_level=None)
    # Older SQLite builds do not provide CONCAT or a math extension.
    db.create_function("concat", -1, lambda *values: "".join(str(v) for v in values if v is not None))
    db.create_function("ceil", 1, lambda value: None if value is None else math.ceil(value))
    db.create_function("ceiling", 1, lambda value: None if value is None else math.ceil(value))
    db.execute("PRAGMA foreign_keys=ON")
    db.execute("PRAGMA temp_store=MEMORY")
    if not ex.get("empty"):
        db.execute("PRAGMA foreign_keys=OFF")
        for name, table in data.items():
            db.execute(table["ddl"])
            params = ",".join("?" for _ in table["columns"])
            rows = list(reversed(table["rows"])) if reverse else table["rows"]
            db.executemany(f"INSERT INTO {name} VALUES ({params})", rows)
        db.execute("PRAGMA foreign_keys=ON")
        db.executescript(ex.get("setup", ""))
    if reverse and key.startswith("5-"):
        # Keep the classroom fixture intact on screen. Vary boundary values
        # for grading and ensure otherwise-empty predicates return a match.
        db.execute("UPDATE angajati SET nume='Lloyd', id_manager=101 WHERE id_angajat=104")
        db.execute("UPDATE angajati SET salariu=12000 WHERE id_angajat=103")
        db.execute("UPDATE angajati SET salariu=5000 WHERE id_angajat=104")
        db.execute("UPDATE comenzi SET data_comanda='1999-11-10', id_angajat="
                   "(SELECT id_angajat FROM angajati WHERE nume='Greene' LIMIT 1) "
                   "WHERE numar_comanda=(SELECT MIN(numar_comanda) FROM comenzi)")
    if reverse:
        db.execute("PRAGMA reverse_unordered_selects=ON")
    db.execute("PRAGMA max_page_count=4096")
    return db


def table_info(db, name):
    columns = db.execute(f'PRAGMA table_info("{name}")').fetchall()
    return [(row[1], row[2], row[3], row[4], row[5]) for row in columns]


def tables(key, ex):
    with closing(connection(key, {**ex, "empty": False})) as db:
        return [{"name": name, "columns": table_info(db, name),
                 "rows": [] if ex.get("empty") else db.execute(f'SELECT * FROM "{name}"').fetchall(),
                 "relations": [(row[3], row[2], row[4]) for row in db.execute(f'PRAGMA foreign_key_list("{name}")')]}
                for name in ex["tables"]]


def statement_list(script):
    pending = ""
    *segments, last = script.split(";")
    for fragment in segments:
        pending += fragment + ";"
        if sqlite3.complete_statement(pending):
            yield pending
            pending = ""
    pending += last
    if pending.strip():
        yield pending


def authorize(write, names, events):
    def allowed(action, name, arg, database, context):
        if context or (action != sqlite3.SQLITE_ALTER_TABLE and database not in (None, "main", "temp")):
            return sqlite3.SQLITE_DENY
        if action in READ_ACTIONS:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_FUNCTION and (arg in FUNCTIONS or (write and arg in SCHEMA_FUNCTIONS)):
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_PRAGMA and not write and name == "table_info" and (arg or "").lower() in names:
            return sqlite3.SQLITE_OK
        if write and (action in WRITE_ACTIONS or
                      (action == sqlite3.SQLITE_CREATE_INDEX and name.startswith("sqlite_autoindex_"))):
            if action == sqlite3.SQLITE_TRANSACTION:
                events.append(arg or name)
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY
    return allowed


def run(db, script, write, names, reverse=False):
    events, results, executed = [], [], []
    db.setlimit(sqlite3.SQLITE_LIMIT_LENGTH, 64_000)
    db.setlimit(sqlite3.SQLITE_LIMIT_COLUMN, 40)
    db.setlimit(sqlite3.SQLITE_LIMIT_VDBE_OP, 30_000)
    db.setlimit(sqlite3.SQLITE_LIMIT_ATTACHED, 0)
    result_bytes = 0
    budget = iter(range(3000))
    db.set_progress_handler(lambda: next(budget, None) is None, 100)
    trace = []
    db.set_trace_callback(trace.append)
    db.set_authorizer(authorize(write, names, events))
    try:
        for statement in statement_list(script):
            before = len(trace)
            cursor = db.execute(statement)
            if len(trace) > before:
                executed.append(statement)
            if cursor.description:
                rows = cursor.fetchmany(5001)
                result_bytes += sum(len(repr(row)) for row in rows)
                if len(rows) > 5000 or result_bytes > 300_000:
                    raise ValueError("Rezultatul este prea mare pentru terminal.")
                if any(isinstance(v, bytes) or (isinstance(v, float) and not math.isfinite(v))
                       for row in rows for v in row):
                    raise ValueError("Rezultatul trebuie să conțină doar texte, numere finite și NULL.")
                results.append(([col[0] for col in cursor.description], rows))
            if len(executed) > 32:
                raise ValueError("Terminalul permite maximum 32 de instrucțiuni la o verificare.")
    finally:
        db.set_authorizer(None)
        db.set_progress_handler(None, 0)
        db.set_trace_callback(None)
    return results, events, executed


def affinity(declared):
    name = declared.upper()
    if "INT" in name: return "INTEGER"
    if any(part in name for part in ("CHAR", "CLOB", "TEXT")): return "TEXT"
    if any(part in name for part in ("REAL", "FLOA", "DOUB")): return "REAL"
    if not name or "BLOB" in name: return "BLOB"
    return "NUMERIC"


def state(db, key):
    result = {}
    for (name,) in db.execute("SELECT name FROM sqlite_schema WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name"):
        quoted = '"' + name.replace('"', '""') + '"'
        cols = tuple((c.lower(), t.upper().replace(" ", "") if key == "4-4.3" and c == "email" else affinity(t),
                      required, (default or "").upper(), pk)
                     for c, t, required, default, pk in table_info(db, name.replace('"', '""')))
        relations = sorted((t.lower(), (src or "").lower(), (dest or "").lower(), on_update, on_delete)
                           for _, _, t, src, dest, on_update, on_delete, _ in db.execute(f"PRAGMA foreign_key_list({quoted})"))
        result[name.lower()] = (cols, relations, Counter(db.execute(f"SELECT * FROM {quoted}")))
    return result


def constraints(db, key):
    if key == "4-1":
        probes = [("INSERT INTO firme VALUES (91,'Test',NULL,?)", item)
                  for item in ("Moldova", "Ardeal", "Banat", "Muntenia", "Dobrogea", "Transilvania", "Inexistent", None)]
    elif key in {"4-4.7", "4-4.8–4.9"}:
        probes = [("INSERT INTO personal (codagent,numeagent,varsta) VALUES ('Z99','Test',?)", age)
                  for age in (-1, 17, 18, 24, None)]
    else:
        return []
    acceptance = []
    for sql, value in probes:
        db.execute("SAVEPOINT probe")
        try:
            db.execute(sql, (value,))
            acceptance.append(True)
        except sqlite3.IntegrityError:
            acceptance.append(False)
        finally:
            db.execute("ROLLBACK TO probe")
            db.execute("RELEASE probe")
    return acceptance


def compare_rows(number, actual, expected):
    if number not in SORT_KEYS:
        return Counter(actual) == Counter(expected)
    def key(row):
        return tuple(row[index] for index in SORT_KEYS[number])
    return [(value, Counter(rows)) for value, rows in groupby(actual, key)] == [
            (value, Counter(rows)) for value, rows in groupby(expected, key)]


def read_check(key, ex, query):
    number = int(key[2:])
    all_tables = LAB["fixtures"]["5"]
    for reverse in (False, True):
        with closing(connection(key, ex, reverse)) as db:
            expected, _, _ = run(db, ex["reference"], False, all_tables)
            actual, _, executed = run(db, query, False, all_tables)
        if not reverse:
            visible = actual
        if len(actual) != len(expected):
            return visible, False, f"Cerința așteaptă {len(expected)} rezultate separate."
        for (columns, rows), (expected_columns, expected_rows) in zip(actual, expected):
            if len(columns) != len(expected_columns):
                return visible, False, f"Rezultatul trebuie să aibă {len(expected_columns)} coloane."
            if any(columns[i].casefold() != expected_columns[i].casefold() for i in NAMED_COLUMNS.get(number, ())):
                return visible, False, "Verifică aliasurile cerute în enunț."
            if not compare_rows(number, rows, expected_rows):
                if number in {34, 46, 48} and time_matches(rows, expected_rows):
                    continue
                return visible, False, "Verifică valorile, numărul de rânduri și ordinea din cerință."
        if number in REQUIRED_SYNTAX and any(not re.search(pattern, stmt, re.I) for pattern, stmt in
                                             zip(REQUIRED_SYNTAX[number], executed)):
            return visible, False, "Folosește metodele diferite cerute în enunț, în ordinea indicată."
    return visible, True, "Rezultatul corespunde cerinței."


def time_matches(rows, expected):
    if len(rows) != 1:
        return False
    try:
        return all(a == b or abs((datetime.fromisoformat(a) - datetime.fromisoformat(b)).total_seconds()) <= 1
                   for a, b in zip(rows[0], expected[0]))
    except (ValueError, TypeError):
        return False


def write_check(key, ex, query):
    with closing(connection(key, ex)) as db, closing(connection(key, ex)) as reference:
        db_results, events, executed = run(db, query, True, ())
        expected_results, expected_events, _ = run(reference, ex["reference"], True, ())
        budget = iter(range(3000))
        db.set_progress_handler(lambda: next(budget, None) is None, 100)
        actual = state(db, key)
        expected = state(reference, key)
        correct = bool(executed) and not db.in_transaction and actual == expected
        if correct:
            correct = constraints(db, key) == constraints(reference, key)
        if key in {"4-7.2", "4-9.3"}:
            correct = correct and all(event in events for event in expected_events)
        if key == "4-9.3":
            correct = correct and any(rows == expected_results[0][1] for _, rows in db_results)
        results = list(db_results)
        if correct and not results:
            for name in ex.get("focus") or []:
                if name in actual:
                    columns, _, rows = actual[name]
                    results.append(([col[0] for col in columns], list(rows.elements())))
        message = "Starea bazei corespunde cerinței." if correct else (
            "Verifică structura, rândurile și tranzacția cerută. Fiecare verificare pornește de la aceleași date inițiale.")
        return results, correct, message


def handle(payload):
    action = payload["university"]
    if action == "catalog":
        return 200, {"exercises": catalog()}
    key = payload.get("exerciseId")
    ex = EXERCISES.get(key) if isinstance(key, str) else None
    if key == "5-console":
        ex = {"tables": list(LAB["fixtures"]["5"]), "focus": []}
    if not ex or action not in ("tables", "run", "check", "solution") or (key == "5-console" and action in ("check", "solution")):
        return 400, {"error": "Alege un exercițiu din catalog."}
    if action == "tables":
        return 200, {"tables": tables(key, ex), "schema": sorted(LAB["fixtures"]["5"]) if key.startswith("5-") else []}
    if action == "solution":
        return 200, {"solution": ex["reference"]}
    query = payload.get("query")
    if not isinstance(query, str) or not query.strip() or len(query) > 12000:
        return 400, {"error": "Introdu un răspuns de maximum 12.000 de caractere."}
    if ex.get("choice"):
        if action == "run":
            return 400, {"error": "Acest exercițiu se verifică printr-un răspuns DA sau NU."}
        correct = query.strip().casefold() == ex["reference"].casefold()
        return 200, {"correct": correct, "message": "Răspuns corect." if correct else "Verifică dacă tabela există.",
                     "results": []}
    try:
        if action == "run":
            with closing(connection(key, ex)) as db:
                results, _, commands = run(db, query, key.startswith("4-") or key == "5-console",
                                           LAB["fixtures"][key[0]])
                if not commands:
                    return 400, {"error": "Scrie cel puțin o comandă SQL."}
            return 200, {"message": f"Executate: {len(commands)}. Fiecare rulare pornește de la datele inițiale.",
                         "results": serialize(results)}
        results, correct, message = write_check(key, ex, query) if key.startswith("4-") else read_check(key, ex, query)
    except ValueError as error:
        return 400, {"error": str(error)}
    except (sqlite3.Error, MemoryError, UnicodeError) as error:
        details = str(error)
        public = re.match(r"^(?:near .*: syntax error|no such (?:table|column): .+|ambiguous column name: .+|"
                          r"incomplete input|table .+ already exists|.+ constraint failed(?:: .+)?)$", details, re.I)
        return 400, {"error": details if public else "SQLite nu a putut executa comanda. Verifică sintaxa, operațiile permise și dimensiunea rezultatului."}
    return 200, {"correct": correct, "message": message, "results": serialize(results)}


def serialize(results):
    return [{"columns": columns, "rows": rows, "count": len(rows)} for columns, rows in results]
