import networkx as nx
from django.db.models import Avg
from django.utils import timezone

from core.models import (
    BankStatement,
    BehavioralData,
    Guarantor,
    Profile,
    PsychometricResponse,
    TrustScoreHistory,
    User,
)


def clamp(value, low=0, high=100):
    return int(max(low, min(high, round(value))))


def weighted_pagerank(graph, iterations=40, damping=0.85):
    nodes = list(graph.nodes())
    if not nodes:
        return {}

    initial = 1.0 / len(nodes)
    ranks = {node: initial for node in nodes}
    out_weight = {
        node: sum(data.get("weight", 1) for _, _, data in graph.out_edges(node, data=True))
        for node in nodes
    }

    for _ in range(iterations):
        next_ranks = {node: (1 - damping) / len(nodes) for node in nodes}
        dangling_rank = sum(ranks[node] for node in nodes if out_weight[node] == 0)
        dangling_share = damping * dangling_rank / len(nodes)
        for node in nodes:
            next_ranks[node] += dangling_share
        for source, target, data in graph.edges(data=True):
            weight = data.get("weight", 1)
            if out_weight[source]:
                next_ranks[target] += damping * ranks[source] * (weight / out_weight[source])
        ranks = next_ranks
    return ranks


class TrustScoreService:
    SOCIAL_WEIGHT = 0.35
    PSYCHOMETRIC_WEIGHT = 0.25
    BEHAVIORAL_WEIGHT = 0.40

    def calculate_for_merchant(self, merchant: User, persist=True, overrides=None) -> dict:
        overrides = overrides or {}
        social = overrides.get("social_component", self.social_score(merchant))
        psychometric = overrides.get("psychometric_component", self.psychometric_score(merchant))
        behavioral_payload = self.behavioral_score(merchant)
        behavioral = overrides.get("behavioral_component", behavioral_payload["score"])

        final_score = clamp(
            social * self.SOCIAL_WEIGHT
            + psychometric * self.PSYCHOMETRIC_WEIGHT
            + behavioral * self.BEHAVIORAL_WEIGHT
        )
        bank_impact = behavioral_payload["bank_impact"]
        explanation = self._explain(final_score, social, psychometric, behavioral, behavioral_payload)

        result = {
            "score": final_score,
            "breakdown": {
                "social_component": social,
                "psychometric_component": psychometric,
                "behavioral_component": behavioral,
                "bank_impact": bank_impact,
                "weights": {
                    "social": self.SOCIAL_WEIGHT,
                    "psychometric": self.PSYCHOMETRIC_WEIGHT,
                    "behavioral": self.BEHAVIORAL_WEIGHT,
                },
            },
            "behavioral_signals": behavioral_payload,
            "explanation": explanation,
        }

        if persist:
            Profile.objects.filter(user=merchant).update(
                trust_score=final_score, score_last_updated=timezone.now()
            )
            TrustScoreHistory.objects.create(
                merchant=merchant,
                score=final_score,
                social_component=social,
                psychometric_component=psychometric,
                behavioral_component=behavioral,
                bank_impact=bank_impact,
                explanation=explanation,
            )
        return result

    def social_score(self, merchant: User) -> int:
        active_edges = Guarantor.objects.filter(status=Guarantor.Status.ACTIVE).select_related(
            "merchant", "guarantor"
        )
        graph = nx.DiGraph()
        strengths = {}
        for edge in active_edges:
            graph.add_edge(edge.guarantor_id, edge.merchant_id, weight=edge.vouch_strength)
            strengths[(edge.guarantor_id, edge.merchant_id)] = edge.vouch_strength

        direct = Guarantor.objects.filter(
            merchant=merchant, status=Guarantor.Status.ACTIVE
        ).aggregate(avg=Avg("vouch_strength"))["avg"] or 0
        direct_score = (direct / 5) * 65

        if merchant.id in graph and graph.number_of_edges():
            pagerank = weighted_pagerank(graph).get(merchant.id, 0)
            network_score = min(25, pagerank * 300)
        else:
            network_score = 0

        fraud_penalty = 0
        if graph.number_of_nodes() > 1:
            for cycle in nx.simple_cycles(graph):
                if merchant.id in cycle and len(cycle) <= 4:
                    fraud_penalty = 25
                    break

        guarantor_count_bonus = min(10, Guarantor.objects.filter(
            merchant=merchant, status=Guarantor.Status.ACTIVE
        ).count() * 3)
        return clamp(direct_score + network_score + guarantor_count_bonus - fraud_penalty)

    def psychometric_score(self, merchant: User) -> int:
        average = PsychometricResponse.objects.filter(merchant=merchant).aggregate(
            avg=Avg("score")
        )["avg"]
        return clamp(average or 0)

    def behavioral_score(self, merchant: User) -> dict:
        non_bank = BehavioralData.objects.filter(merchant=merchant).exclude(
            metrics_json__source="bank_statement"
        )
        non_bank_scores = []
        for item in non_bank:
            metrics = item.metrics_json or {}
            if "score" in metrics:
                non_bank_scores.append(float(metrics["score"]))
            else:
                punctuality = float(metrics.get("payment_punctuality", 50))
                frequency = float(metrics.get("transaction_frequency", 50))
                growth = float(metrics.get("revenue_growth", 50))
                non_bank_scores.append((punctuality * 0.45) + (frequency * 0.35) + (growth * 0.20))

        base_behavior = sum(non_bank_scores) / len(non_bank_scores) if non_bank_scores else 35

        latest_statement = BankStatement.objects.filter(merchant=merchant).order_by("-uploaded_at").first()
        bank_score = None
        bank_impact = 0
        if latest_statement:
            summary = latest_statement.analysis_summary or {}
            bank_score = float(summary.get("bank_behavior_score", 0))
            bank_impact = clamp(bank_score - base_behavior, -100, 100)
            combined = (base_behavior * 0.35) + (bank_score * 0.65)
        else:
            combined = base_behavior

        return {
            "score": clamp(combined),
            "non_bank_behavior_score": clamp(base_behavior),
            "bank_statement_score": clamp(bank_score or 0),
            "bank_impact": bank_impact,
            "has_bank_statement": latest_statement is not None,
        }

    def simulate(self, merchant: User, scenario: dict) -> dict:
        return self.calculate_for_merchant(
            merchant,
            persist=False,
            overrides={
                key: scenario[key]
                for key in ["social_component", "psychometric_component", "behavioral_component"]
                if key in scenario
            },
        )

    def _explain(self, final_score, social, psychometric, behavioral, behavioral_payload):
        bank_text = "No bank statement has been analyzed yet."
        if behavioral_payload["has_bank_statement"]:
            impact = behavioral_payload["bank_impact"]
            direction = "improved" if impact >= 0 else "reduced"
            bank_text = f"Bank statement signals {direction} the behavioral component by {abs(impact)} points."

        if final_score >= 75:
            tier = "Strong trust profile"
        elif final_score >= 55:
            tier = "Developing trust profile"
        else:
            tier = "Thin or higher-risk trust profile"

        return (
            f"{tier}. Social graph contributed {social}/100, psychometric responses "
            f"contributed {psychometric}/100, and behavioral signals contributed {behavioral}/100. "
            f"{bank_text}"
        )
