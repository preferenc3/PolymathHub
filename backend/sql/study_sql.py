"""SQLite grading for the guided inventory lessons, using disposable fixtures."""
from collections import Counter
from contextlib import closing
import sqlite3

from backend.sql import university_sql

SCHEMA = {
    "echipamente": ("id INTEGER PRIMARY KEY, tip TEXT NOT NULL, producator TEXT NOT NULL, model TEXT NOT NULL, "
                    "stoc INTEGER NOT NULL CHECK(stoc >= 0), pret REAL NOT NULL"),
    "birouri": "id INTEGER PRIMARY KEY, nume TEXT NOT NULL",
    "comenzi_it": ("id INTEGER PRIMARY KEY, birou_id INTEGER REFERENCES birouri(id), "
                   "echipament_id INTEGER REFERENCES echipamente(id), cantitate INTEGER NOT NULL CHECK(cantitate > 0), "
                   "instalare REAL NOT NULL"),
}
EQUIPMENT = [
    (1, "Calculator", "Lenovo", "ThinkCentre", 8, 3150.50),
    (2, "Imprimantă", "HP", "LaserJet", 5, 2450),
    (3, "Calculator", "Dell", "OptiPlex", 3, 2850.75),
    (4, "Monitor", "AOC", "Q27", 0, 1199.90),
]
REFERENCES = {
    "path-sql-select": ("read", "SELECT * FROM echipamente"),
    "path-sql-columns": ("read", "SELECT model, pret FROM echipamente"),
    "path-sql-where": ("read", "SELECT model FROM echipamente WHERE stoc >= 5"),
    "path-sql-sum": ("read", "SELECT ROUND(SUM(stoc * pret), 2) FROM echipamente"),
    "path-sql-insert": ("insert", "INSERT INTO echipamente VALUES (11, 'Imprimantă', 'Canon', 'PIXMA', 3, 950)"),
    "path-sql-update": ("update", "UPDATE echipamente SET stoc = stoc + 2 WHERE id = 2"),
    "path-sql-join": ("relations", "SELECT e.model, c.cantitate FROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id"),
    "path-sql-concat": ("read", "SELECT tip || ' - ' || model FROM echipamente"),
    "path-sql-order-total": ("relations", "SELECT ROUND(c.cantitate * (e.pret + c.instalare) * 1.19, 2) "
                             "FROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id WHERE c.id = 101"),
    "path-sql-it-project": (
        "project",
        "INSERT INTO comenzi_it VALUES (103, 2, 2, 2, 125);"
        "UPDATE echipamente SET stoc = stoc - 2 WHERE id = 2;"
        "SELECT b.nume, e.producator || ' ' || e.model, e.stoc, "
        "ROUND(c.cantitate * (e.pret + c.instalare) * 1.19, 2) "
        "FROM comenzi_it c JOIN echipamente e ON e.id = c.echipament_id "
        "JOIN birouri b ON b.id = c.birou_id WHERE c.id = 103;"
    ),
}


def connection(variant, operation):
    db = sqlite3.connect(":memory:", isolation_level=None)
    db.execute("PRAGMA foreign_keys = ON")
    names = SCHEMA if operation in ("project", "relations") else ("echipamente",)
    for table in names:
        db.execute(f"CREATE TABLE {table} ({SCHEMA[table]})")
    equipment = EQUIPMENT if not variant else [
        (1, "Calculator", "Lenovo", "M90", 4, 2930.30),
        (2, "Imprimantă", "Brother", "HL-L2460", 7, 1699.99),
        (3, "Calculator", "Dell", "OptiPlex", 5, 2870.10),
        (4, "Monitor", "AOC", "Q27", 5, 995),
    ]
    db.executemany("INSERT INTO echipamente VALUES (?,?,?,?,?,?)", equipment)
    if operation in ("project", "relations"):
        db.executemany("INSERT INTO birouri VALUES (?,?)",
                       [(1, "Secretariat"), (2, "Proiectare" if not variant else "Atelier"), (3, "Suport")])
        db.executemany("INSERT INTO comenzi_it VALUES (?,?,?,?,?)", [(101, 1, 1, 2, 80), (102, 3, 4, 1, 30)])
    return db


def policy(operation, names):
    insert_target = {"project": "comenzi_it", "insert": "echipamente"}.get(operation)
    functions = {"sum", "round", "concat", "lower", "upper", "trim", "coalesce", "cast", "printf"}

    def allow(action, name, arg, database, context):
        if context or database not in (None, "main"):
            return sqlite3.SQLITE_DENY
        if action == sqlite3.SQLITE_SELECT:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_READ and name in names:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_FUNCTION and arg in functions:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_INSERT and name == insert_target:
            return sqlite3.SQLITE_OK
        if action == sqlite3.SQLITE_UPDATE and operation in ("update", "project") and name == "echipamente" and arg == "stoc":
            return sqlite3.SQLITE_OK
        return sqlite3.SQLITE_DENY

    return allow


def execute(query, operation, variant):
    names = list(SCHEMA) if operation in ("project", "relations") else ["echipamente"]
    with closing(connection(variant, operation)) as db:
        db.create_function("concat", -1, lambda *values: "".join(str(v) for v in values if v is not None))
        results, _, commands = university_sql.run(db, query, False, names, authorization=policy(operation, names))
        if not commands:
            raise ValueError("Scrie cel puțin o instrucțiune SQL.")
        tables = [db.execute(f"SELECT * FROM {name} ORDER BY id").fetchall() for name in names] if operation in ("insert", "update", "project") else []
        return results, tables


def matches(actual, expected, operation, key):
    results, tables = actual
    expected_results, expected_tables = expected
    if tables != expected_tables:
        return False
    if operation in ("insert", "update"):
        return True
    if len(results) != 1:
        return False
    columns, rows = results[0]
    expected_columns, expected_rows = expected_results[0]
    same_columns = len(columns) == len(expected_columns)
    if key in ("path-sql-select", "path-sql-columns", "path-sql-where"):
        same_columns = same_columns and [column.casefold() for column in columns] == expected_columns
    return same_columns and Counter(rows) == Counter(expected_rows)


def handle(payload):
    key = payload.get("studySql")
    query = payload.get("query")
    if not isinstance(key, str) or key not in REFERENCES or not isinstance(query, str) or not query.strip() or len(query) > 8000:
        return 400, {"error": "Alege o temă SQL și scrie între 1 și 8.000 de caractere."}
    operation, reference = REFERENCES[key]
    try:
        visible = execute(query, operation, 0)
        correct = matches(visible, execute(reference, operation, 0), operation, key)
        if correct:
            correct = matches(execute(query, operation, 1), execute(reference, operation, 1), operation, key)
    except (sqlite3.Error, ValueError, MemoryError, UnicodeError):
        return 400, {"error": "SQLite nu a putut executa scriptul. Verifică sintaxa, numele și operațiile cerute."}
    results, tables = visible
    if results:
        columns, rows = results[-1]
    elif operation in ("insert", "update"):
        columns = ["id", "tip", "producator", "model", "stoc", "pret"]
        rows = tables[0]
    else:
        columns, rows = [], []
    return 200, {"correct": correct, "columns": columns, "rows": rows,
                 **({} if correct else {"error": "Rezultatul sau modificările diferă de cerință. Verifică selecția și efectul scriptului pe date."})}
