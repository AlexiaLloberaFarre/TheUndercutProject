"""The catalogue is hand-edited JSON, so it gets its own guardrails."""

from __future__ import annotations

import copy
import unittest

from kpi_framework.catalogue import Catalogue, load_catalogue, validate

CAT = load_catalogue()


def mutated(**changes) -> Catalogue:
    kpis = copy.deepcopy(CAT.kpis)
    kpis[0].update(changes)
    return Catalogue(kpis=kpis, categories=CAT.categories, accountabilities=CAT.accountabilities,
                     phases=CAT.phases, meta=CAT.meta)


class ShapeTest(unittest.TestCase):
    def test_the_shipped_catalogue_is_valid(self) -> None:
        self.assertEqual(validate(CAT), [])

    def test_it_is_the_framework_described_in_the_proposal(self) -> None:
        self.assertEqual(len(CAT.kpis), 22)
        self.assertEqual(len(CAT.categories), 7)
        self.assertEqual(len(CAT.accountabilities), 8)
        self.assertEqual(len(CAT.headline()), 7)

    def test_every_accountability_is_covered_by_at_least_one_kpi(self) -> None:
        covered = {a for k in CAT.kpis for a in k["accountabilities"]}
        self.assertEqual(covered, {a["id"] for a in CAT.accountabilities})

    def test_every_category_carries_kpis(self) -> None:
        for category in CAT.categories:
            self.assertTrue(CAT.by_category(category["id"]), f"{category['id']} has no KPIs")

    def test_lookup_by_id_or_slug(self) -> None:
        self.assertIs(CAT.kpi("K1.1"), CAT.kpi("dil-availability"))
        with self.assertRaises(KeyError):
            CAT.kpi("not-a-kpi")

    def test_targets_carry_a_watch_threshold_on_the_correct_side(self) -> None:
        for k in CAT.kpis:
            if k["direction"] == "up":
                self.assertLessEqual(k["amber"], k["target"], k["id"])
            else:
                self.assertGreaterEqual(k["amber"], k["target"], k["id"])

    def test_the_illustrative_caveat_travels_with_the_data(self) -> None:
        self.assertIn("illustrative", CAT.meta["disclaimer"].lower())


class ValidatorTest(unittest.TestCase):
    def test_catches_a_backwards_watch_threshold(self) -> None:
        self.assertTrue(any("amber" in p for p in validate(mutated(amber=99.5))))

    def test_catches_an_unknown_accountability(self) -> None:
        self.assertTrue(any("unknown accountability" in p for p in validate(mutated(accountabilities=["A9"]))))

    def test_catches_a_duplicate_metric(self) -> None:
        problems = validate(mutated(metric=CAT.kpis[1]["metric"]))
        self.assertTrue(any("duplicate metric" in p for p in problems))

    def test_catches_a_missing_field(self) -> None:
        kpis = copy.deepcopy(CAT.kpis)
        del kpis[0]["formula"]
        broken = Catalogue(kpis=kpis, categories=CAT.categories, accountabilities=CAT.accountabilities,
                           phases=CAT.phases, meta=CAT.meta)
        self.assertTrue(any("formula" in p for p in validate(broken)))


if __name__ == "__main__":
    unittest.main()
