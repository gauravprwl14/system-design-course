---
title: "Your Story"
description: "Why you're here, what problem this solves, and what you'll be able to do when you leave."
layer: index
section: "00-start-here"
---

# Your Story

You're a backend engineer. Your startup just crossed 100k users. Congratulations — and here's the problem: your single Postgres instance is now at 90% CPU. Your CTO is in a Slack thread at 2 AM. Your users are seeing timeouts. You have 48 hours to fix it, and three senior engineers in the thread are arguing about whether to add a read replica, shard the database, or just throw more CPU at the problem. You don't know who's right. You're not sure you have the vocabulary to make the case either way. That moment — where the system is breaking and the decision is unclear and every option has a cost — is exactly what this course is built for.

This is not a reference library. Every concept here comes with a failure scenario: what breaks, at what scale, and why. The articles on database replication exist because engineers have failed over to a replica and discovered their data was 45 seconds stale. The articles on consistent hashing exist because cache clusters have been destroyed by a single node restart remapping 75% of keys during a traffic spike. The articles on message queues exist because engineers have learned the hard way that synchronous fan-out to 10 million followers doesn't scale. The knowledge in this course was extracted from post-mortems, engineering blogs, and production incidents — then organized so you can absorb it before your own 2 AM Slack thread.

There is a second reason engineers come here: interviews. System design interviews at senior levels are not trick questions. They are 45 minutes of "here is a vague problem, show me how you reason about trade-offs at scale." The interviewer is watching whether you know what breaks at 10k users vs 10 million, whether you can name two approaches and articulate what each costs, and whether your instincts about consistency vs availability are grounded in something real. This course teaches that reasoning directly — not interview patterns to memorize, but the underlying mental models that let you derive the right answer to a problem you've never seen before.

Two paths forward, depending on where you are right now. If you want the fastest possible route to covering the essentials — one clear sequence, 12 articles, ~6 hours — start with the [Fast Path](./fast-path). If you want a structured track matched to your specific role and goals — junior engineer building fundamentals, mid-level engineer preparing for a senior loop, staff engineer preparing for a principal loop — start with [Learning Paths](./learning-paths). Either way, you're in the right place.
