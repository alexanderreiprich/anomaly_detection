from typing import Optional

import pandas as pd
from .labels import Label
from .rules import LabelingRule, DEFAULT_RULES

class AutoLabeler:
    """
    Applies rules in descending priority order.

    Conflicts: If multiple rules apply, the one with the higher `priority` wins. 
    Is the priority identical wins Critical followed by Warning followed by Acceptable.

    No rule applies: Acceptable.
    """

    LABEL_SEVERITY = {
        Label.CRITICAL:   2,
        Label.WARNING:    1,
        Label.ACCEPTABLE: 0,
    }

    def __init__(self, rules: list[LabelingRule] = DEFAULT_RULES):
        self.rules = sorted(rules, key=lambda r: r.priority, reverse=True)

    def label_row(self, row: pd.Series) -> dict:
        winning_label: Optional[Label] = None
        winning_rule:  str             = "default"
        winning_prio:  int             = -1

        for rule in self.rules:
            result = rule.apply(row)
            if result is None:
                continue

            better_priority  = rule.priority > winning_prio
            same_priority_worse_label = (
                rule.priority == winning_prio
                and self.LABEL_SEVERITY[result] > self.LABEL_SEVERITY.get(winning_label, -1)
            )

            if better_priority or same_priority_worse_label:
                winning_label = result
                winning_rule  = rule.name
                winning_prio  = rule.priority

        if winning_label is None:
            winning_label = Label.ACCEPTABLE
            winning_rule  = "default"

        return {
            "auto_label":          winning_label.value,
            "label_rule":          winning_rule,
            "human_review_needed": False,
            "confidence":          1.0,
        }

    def label_dataframe(self, df: pd.DataFrame) -> pd.DataFrame:
        results = df.apply(self.label_row, axis=1, result_type="expand")
        return pd.concat([df, results], axis=1)


