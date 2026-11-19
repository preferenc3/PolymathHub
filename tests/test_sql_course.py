import json
import runpy
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LAB = runpy.run_path(str(ROOT / 'api/sql-lab.py'))

class SqlCourseTests(unittest.TestCase):
    def evaluate(self, exercise, query, variant=0):
        return LAB['evaluate'](json.dumps({'exerciseId': exercise, 'query': query, 'variant': variant}).encode())

    def test_inventory_project_checks_mutations_and_report_on_fresh_data(self):
        from server.study_sql import REFERENCES

        lesson = "path-sql-it-project"
        reference = REFERENCES[lesson][1]

        def check(query):
            return LAB["evaluate"](json.dumps({"studySql": lesson, "query": query}).encode())

        status, result = check(reference)
        self.assertEqual(status, 200)
        self.assertTrue(result["correct"])
        self.assertEqual(result["rows"], [("Proiectare", "HP LaserJet", 3, 6128.5)])

        fixed_result = reference[:reference.index("SELECT")] + "SELECT 'Proiectare', 'HP LaserJet', 3, 6128.5"
        self.assertFalse(check(fixed_result)[1]["correct"])
        self.assertFalse(check(reference.replace("stoc - 2", "stoc - 1"))[1]["correct"])
        self.assertTrue(check(reference)[1]["correct"])

    def test_inventory_read_only_exercise_rejects_modification(self):
        payload = {"studySql": "path-sql-select", "query": "UPDATE echipamente SET stoc = 0"}
        status, _ = LAB["evaluate"](json.dumps(payload).encode())
        self.assertEqual(status, 400)

    def test_course_has_six_lessons_twelve_exercises_and_three_project_tasks(self):
        course = LAB['public_course']()
        self.assertEqual(len(course['lessons']), 6)
        self.assertEqual(sum(len(x['exercises']) for x in course['lessons']), 12)
        self.assertEqual(len(course['project']['exercises']), 3)
        encoded = json.dumps(course)
        self.assertNotIn('reference', encoded)
        self.assertNotIn('hidden', encoded)
        for ex in course['exercises']:
            self.assertEqual(len(ex['hints']), 3)
            self.assertIn('explanation', ex)
        self.assertNotEqual(course['datasets'][0], course['datasets'][1])

    def test_all_reference_solutions_work_on_both_public_variants(self):
        data = json.loads((ROOT / 'server/sql-course.json').read_text())
        for ex in data['exercises']:
            for variant in (0, 1):
                with self.subTest(exercise=ex['id'], variant=variant):
                    status, result = self.evaluate(ex['id'], ex['reference'], variant)
                    self.assertEqual(status, 200)
                    self.assertTrue(result['correct'], result)

    def test_equivalent_projection_and_aliases_are_accepted(self):
        status, result = self.evaluate('s2-alias', 'select name as articol, price as cost from products')
        self.assertEqual(status, 200)
        self.assertTrue(result['correct'])

    def test_each_theory_example_includes_results_for_both_visible_datasets(self):
        lessons = LAB['public_course']()['lessons']
        self.assertEqual(lessons[0]['exampleResults'][0]['columns'], ['id', 'name', 'city'])
        self.assertEqual(lessons[0]['exampleResults'][0]['rows'][0], (1, 'Ana', 'Bălți'))
        self.assertEqual(lessons[3]['exampleResults'][0]['rows'], [('Pix', 30), ('Agendă', 12)])
        self.assertEqual(lessons[3]['exampleResults'][1]['rows'], [('Abțibild', 12), ('Set desen', 6)])
        for lesson in lessons:
            self.assertEqual(len(lesson['exampleResults']), 2)
            self.assertTrue(lesson['exampleExplanation'])
            self.assertTrue(lesson['commonMistake'])

    def test_wrong_answer_feedback_identifies_the_observable_problem(self):
        cases = [
            ('s1-all', 'SELECT name FROM customers', 'columns'),
            ('s1-all', 'SELECT * FROM customers LIMIT 1', 'row-count'),
            ('s4-price', 'SELECT name, price FROM products ORDER BY price ASC, id ASC', 'row-order'),
            ('s2-select', 'SELECT name, stock FROM products', 'values'),
            ('s1-all', 'SELECT * FROM customers WHERE id < 10', 'check-data'),
        ]
        for exercise, query, code in cases:
            with self.subTest(code=code):
                status, result = self.evaluate(exercise, query)
                self.assertEqual(status, 200)
                self.assertFalse(result['correct'])
                self.assertEqual(result['errorCode'], code)
                self.assertTrue(result['error'])
                self.assertIn('rows', result)

    def test_execution_errors_offer_specific_safe_explanations(self):
        cases = [
            ('SELECT FROM customers', 'syntax'),
            ('SELECT missing FROM customers', 'column'),
            ('SELECT * FROM customer', 'table'),
            ('SELECT id FROM customers c JOIN orders o ON c.id = o.customer_id', 'ambiguous-column'),
            ("SELECT load_extension('private/path')", 'unsupported'),
        ]
        for query, code in cases:
            with self.subTest(code=code):
                status, result = self.evaluate('s1-all', query)
                self.assertEqual(status, 400)
                self.assertEqual(result['errorCode'], code)
                self.assertNotIn('private/path', result['error'])

    def test_hidden_price_ties_reject_the_wrong_secondary_order(self):
        status, result = self.evaluate('s4-price', 'SELECT name, price FROM products ORDER BY price DESC, id DESC')
        self.assertEqual(status, 200)
        self.assertFalse(result['correct'])

    def test_ordered_tasks_do_not_depend_on_incidental_index_order(self):
        for exercise, query in [
            ('s4-price', 'SELECT name, price FROM products ORDER BY price DESC'),
            ('s4-limit', 'SELECT name, price FROM products ORDER BY name ASC LIMIT 3'),
            ('p1', "SELECT id, total FROM orders WHERE status = 'completed' AND total >= 100 ORDER BY total DESC"),
        ]:
            with self.subTest(exercise=exercise):
                status, result = self.evaluate(exercise, query)
                self.assertEqual(status, 200)
                self.assertFalse(result['correct'])

    def test_wrong_queries_for_every_task_are_rejected_on_both_variants(self):
        wrong = {
            's1-all': 'SELECT id, name FROM customers',
            's1-columns': 'SELECT name, id FROM customers',
            's2-select': 'SELECT name, stock FROM products',
            's2-alias': 'SELECT price AS produs, name AS pret FROM products',
            's3-stock': 'SELECT name, price FROM products WHERE stock > 0 AND price < 100',
            's3-orders': "SELECT id, total FROM orders WHERE status = 'completed' AND total > 100",
            's4-price': 'SELECT name, price FROM products ORDER BY price ASC, id ASC',
            's4-limit': 'SELECT name, price FROM products ORDER BY name ASC, id ASC LIMIT 2',
            's5-inner': 'SELECT c.name, o.total FROM customers c JOIN orders o ON c.id = o.id',
            's5-left': 'SELECT c.name, o.total FROM customers c JOIN orders o ON c.id = o.customer_id',
            's6-cities': 'SELECT city, COUNT(*) FROM customers GROUP BY id',
            's6-status': 'SELECT status, COUNT(*), SUM(total) FROM orders GROUP BY id',
            'p1': "SELECT id, total FROM orders WHERE status = 'completed' ORDER BY total DESC, id ASC",
            'p2': 'SELECT c.name, c.city, o.total FROM customers c JOIN orders o ON c.id = o.customer_id',
            'p3': "SELECT c.id, c.name, COUNT(*), COALESCE(SUM(o.total), 0) FROM customers c LEFT JOIN orders o ON c.id = o.customer_id AND o.status = 'completed' GROUP BY c.id, c.name",
        }
        for exercise, query in wrong.items():
            for variant in (0, 1):
                with self.subTest(exercise=exercise, variant=variant):
                    status, result = self.evaluate(exercise, query, variant)
                    self.assertEqual(status, 200)
                    self.assertFalse(result['correct'])

    def test_equivalent_filters_joins_and_aggregates_are_accepted(self):
        equivalent = {
            's3-stock': 'SELECT name AS produs, price AS pret FROM products WHERE NOT(stock <= 0) AND 100 >= price',
            's5-inner': 'SELECT c.name, o.total FROM orders o INNER JOIN customers c ON c.id = o.customer_id',
            's6-cities': 'SELECT city AS oras, SUM(1) AS numar FROM customers GROUP BY city',
            'p3': "SELECT c.id, c.name, (SELECT COUNT(*) FROM orders o WHERE o.customer_id=c.id AND o.status='completed'), (SELECT COALESCE(SUM(o.total),0) FROM orders o WHERE o.customer_id=c.id AND o.status='completed') FROM customers c",
        }
        for exercise, query in equivalent.items():
            for variant in (0, 1):
                with self.subTest(exercise=exercise, variant=variant):
                    status, result = self.evaluate(exercise, query, variant)
                    self.assertEqual(status, 200)
                    self.assertTrue(result['correct'])

    def test_order_is_required_where_requested_and_ties_are_checked(self):
        self.assertFalse(self.evaluate('s4-price', 'SELECT name, price FROM products ORDER BY price ASC, id ASC')[1]['correct'])
        self.assertTrue(self.evaluate('s4-price', 'SELECT name, price FROM products ORDER BY price DESC, id ASC')[1]['correct'])

    def test_duplicates_nulls_and_hidden_data_prevent_accidental_acceptance(self):
        self.assertFalse(self.evaluate('s1-all', 'SELECT * FROM customers WHERE id IN (1,2,3,4)')[1]['correct'])
        self.assertFalse(self.evaluate('s5-left', 'SELECT c.name, o.total FROM customers c JOIN orders o ON o.customer_id=c.id')[1]['correct'])
        self.assertFalse(self.evaluate('s6-cities', 'SELECT DISTINCT city, 1 FROM customers')[1]['correct'])

    def test_safe_functions_work_and_dangerous_operations_are_denied(self):
        self.assertTrue(self.evaluate('s6-cities', 'SELECT city, count(*) FROM customers GROUP BY city')[1]['correct'])
        for sql in ['DELETE FROM orders', 'PRAGMA table_info(orders)', 'SELECT * FROM sqlite_master', "SELECT load_extension('x')", 'SELECT randomblob(999999999)', 'SELECT * FROM customers; SELECT * FROM orders', 'SELECT name FROM pragma_table_info(\'orders\')']:
            with self.subTest(sql=sql):
                self.assertEqual(self.evaluate('s1-all', sql)[0], 400)

    def test_safe_count_and_constant_table_scans_run_even_when_the_answer_is_wrong(self):
        for query in ['SELECT COUNT(*) FROM customers', 'SELECT COUNT(id) FROM customers', 'SELECT 1 FROM customers']:
            with self.subTest(query=query):
                status, result = self.evaluate('s1-all', query)
                self.assertEqual(status, 200)
                self.assertFalse(result['correct'])

    def test_binary_and_nonfinite_results_return_serializable_feedback(self):
        for query in ['SELECT CAST(name AS BLOB) FROM customers', 'SELECT 1e999']:
            with self.subTest(query=query):
                status, result = self.evaluate('s1-all', query)
                self.assertEqual(status, 400)
                self.assertIn('error', result)
                json.dumps(result, allow_nan=False)

    def test_invalid_ids_variants_and_bounded_feedback(self):
        self.assertEqual(self.evaluate('missing', 'SELECT 1')[0], 400)
        self.assertEqual(self.evaluate('s1-all', 'SELECT 1', 9)[0], 400)
        self.assertEqual(self.evaluate('s1-all', 'SELECT 1', True)[0], 400)
        self.assertEqual(self.evaluate('s1-all', 'SELECT ' + '1' * 2001)[0], 400)
        result = self.evaluate('s1-all', 'SELECT city FROM customers')[1]
        self.assertFalse(result['correct'])
        self.assertIn('error', result)
        self.assertNotIn('reference', json.dumps(result))

if __name__ == '__main__': unittest.main()
