# Projet DevOps - Deploiement & Observabilite

Stack DevOps conteneurisee sur VM Ubuntu (192.168.56.10) avec application Python, Prometheus, Node Exporter, Grafana et pipeline CI/CD GitHub Actions (runner self-hosted).

## Services et Ports
- app : [http://192.168.56.10:5111](http://192.168.56.10:5111)
- prometheus : [http://192.168.56.10:9090](http://192.168.56.10:9090)
- node-exporter : port 9100 (interne)
- grafana : [http://192.168.56.10:3000](http://192.168.56.10:3000)

## Tableaux de bord Grafana
- Mon application
- Node Exporter Full

## CI/CD (GitHub Actions)
- Declenchement automatique sur push vers la branche principal.
- build-test : installation des dependances, tests unitaires et build Docker.
- deploy : mise a jour du depot sur le runner self-hosted et redeploiement via docker compose up -d --build.
