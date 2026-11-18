import json
import runpy
import unittest
from pathlib import Path

evaluate = runpy.run_path(str(Path(__file__).resolve().parents[1] / "api/sql-lab.py"))["evaluate"]


def request(action, key=None, query=None):
    return evaluate(json.dumps({"university": action, "exerciseId": key, "query": query}).encode())


class UniversitySQLTests(unittest.TestCase):
    def test_catalog_and_all_exercises(self):
        status, catalog = request("catalog")
        self.assertEqual(status, 200)
        self.assertEqual(len(catalog["exercises"]), 96)
        for item in catalog["exercises"]:
            key = item["id"]
            with self.subTest(key=key):
                self.assertNotIn("reference", item)
                self.assertEqual(request("tables", key)[0], 200)
                _, solution = request("solution", key)
                status, result = request("check", key, solution["solution"])
                self.assertEqual(status, 200, result)
                self.assertTrue(result["correct"], result)

    def test_empty_result_is_checked_on_additional_data(self):
        status, result = request("check", "5-27", "SELECT nume FROM angajati WHERE 0")
        self.assertEqual(status, 200)
        self.assertEqual(result["results"][0]["rows"], [])
        self.assertFalse(result["correct"])

    def test_execution_does_not_grade_or_persist_changes(self):
        status, result = request("run", "5-console", "CREATE TABLE test (n INT); INSERT INTO test VALUES (1); SELECT * FROM test;")
        self.assertEqual(status, 200)
        self.assertNotIn("correct", result)
        self.assertEqual(result["results"][0]["rows"], [(1,)])
        self.assertEqual(request("run", "5-console", "SELECT * FROM test;")[0], 400)

    def test_rollback_requires_demonstrating_the_empty_table(self):
        status, result = request("check", "4-9.3", "BEGIN; DELETE FROM salariati; ROLLBACK;")
        self.assertEqual(status, 200)
        self.assertFalse(result["correct"])

    def test_read_exercise_rejects_mutation(self):
        self.assertEqual(request("run", "5-12", "DELETE FROM angajati")[0], 400)


if __name__ == "__main__":
    unittest.main()
