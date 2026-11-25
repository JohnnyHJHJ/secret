"""
Small glue between server.py and streaks.py: loads and saves streaks.json, records activity,
and builds the summary the web interface shows. Standard library only.
"""
import datetime as dt

import streaks


class Tracker:
    def __init__(self, path, lock):
        self.path, self.lock = path, lock

    def goal(self, cfg):
        try:
            return max(1, min(50, int(cfg.get("daily_goal") or streaks.DEFAULT_GOAL)))
        except (TypeError, ValueError):
            return streaks.DEFAULT_GOAL

    def state(self, cfg, ctx, month=None, with_calendar=True):
        """ctx = {"scores": {iid: pts}, "done_count": int, "points": {iid: max pts}}"""
        with self.lock:
            data = streaks.load(self.path)
            out = streaks.state(data, dt.date.today(), ctx["scores"], ctx["done_count"], ctx["points"],
                                goal=self.goal(cfg), month=month, with_calendar=with_calendar)
            if out["changed"]:
                streaks.save(self.path, data)
            return out

    def record(self, kind, cfg, ctx, iid=None, earned=None, maximum=None):
        """Note one piece of coding and return what the interface should celebrate."""
        with self.lock:
            data = streaks.load(self.path)
            r = streaks.record(data, kind, goal=self.goal(cfg), iid=iid, earned=earned, maximum=maximum)
            streaks.save(self.path, data)
            st = self.state(cfg, ctx, with_calendar=False)
        return {"first_of_day": r["first_of_day"], "goal_hit": r["goal_hit"], "current": st["current"],
                "best": st["best"], "today_n": st["today_n"], "goal": st["goal"], "new_badges": st["new_badges"],
                "level": st["level"], "level_title": st["level_title"], "xp": st["xp"],
                "restores_left": st["restores_left"], "status": st["status"], "offer": st["offer"]}

    def restore(self):
        with self.lock:
            data = streaks.load(self.path)
            ok, reason = streaks.apply_restore(data, dt.date.today())
            if ok:
                streaks.save(self.path, data)
            return ok, reason
