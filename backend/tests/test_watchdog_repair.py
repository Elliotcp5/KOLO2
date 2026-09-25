"""Test d'auto-réparation : tue les 2 schedulers en mémoire puis vérifie
que le watchdog les ressuscite au tour suivant.

Lancer via un exec dans le process backend (impossible depuis l'extérieur car
les singletons `_scheduler`, `_a3_task`, `_watchdog_task` sont locaux au
process). On utilise donc `curl` sur un endpoint admin temporaire qu'on ajoute
au routeur d1 sous flag env `KOLO_ALLOW_DEV_KILL=1`.
"""
