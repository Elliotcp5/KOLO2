# 🚀 Setup `api.trykolo.io` — URL stable backend (KOLO v2.4)

## Pourquoi ?
Les URLs `*.preview.emergentagent.com` sont des environnements de preview qui peuvent
être renouvelés à chaque session. Une app iOS sur App Store ne peut pas dépendre
d'une URL qui change. Solution : **une URL stable que TU contrôles via ton DNS**,
qui forwarde vers le backend Emergent actuel.

---

## ⚡ Setup en 5 minutes (Cloudflare — tu as déjà CF sur trykolo.io)

### Étape 1 — Crée le Worker
1. Va sur https://dash.cloudflare.com
2. Sélectionne ton compte → **Workers & Pages** dans la sidebar
3. Clique **Create application** → **Create Worker**
4. Nom suggéré : `kolo-api-proxy`
5. Clique **Deploy** (pour créer le squelette)
6. Clique **Edit code**, **supprime tout** et **colle ce code** :

```js
// Proxy HTTPS /api/* depuis trykolo.io vers le backend Emergent.
// Réécrit le Host header car le backend filtre dessus.
const BACKEND = "https://responsive-kolo.preview.emergentagent.com";
const BACKEND_HOST = "responsive-kolo.preview.emergentagent.com";

export default {
  async fetch(request) {
    const url = new URL(request.url);
    // Construit la requête forwardée
    const target = new URL(url.pathname + url.search, BACKEND);
    const headers = new Headers(request.headers);
    headers.set("host", BACKEND_HOST);
    headers.set("x-forwarded-host", url.host);
    headers.set("x-forwarded-proto", "https");

    const init = {
      method: request.method,
      headers,
      body: ["GET", "HEAD"].includes(request.method) ? undefined : request.body,
      redirect: "manual",
    };
    const resp = await fetch(target.toString(), init);

    // Recopie la réponse en activant CORS pour l'app mobile
    const respHeaders = new Headers(resp.headers);
    respHeaders.set("access-control-allow-origin", "*");
    respHeaders.set("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    respHeaders.set("access-control-allow-headers", "Authorization,Content-Type,Accept");
    return new Response(resp.body, { status: resp.status, headers: respHeaders });
  },
};
```

7. Clique **Save and Deploy** (en haut à droite)

### Étape 2 — Branche le Worker sur `api.trykolo.io`
1. Reste sur la page du Worker → onglet **Settings** → **Triggers**
2. Sous **Custom Domains**, clique **Add Custom Domain**
3. Saisis : `api.trykolo.io`
4. Clique **Add Custom Domain**

Cloudflare va automatiquement :
- Créer le DNS (record `AAAA api → 100::`)
- Émettre un certificat SSL Let's Encrypt pour `api.trykolo.io`
- Brancher le Worker sur ce domaine

⏱️ Activation : environ 1 à 5 minutes.

### Étape 3 — Vérifie
Une fois le statut "Active" dans Custom Domains, teste depuis ton terminal :

```bash
curl -X POST https://api.trykolo.io/api/v2/auth/send-email-code \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com"}'
```

Tu dois recevoir `{"sent":true,"dev_code":"..."}` (HTTP 200).
**Si tu reçois ça, c'est gagné. ✅**

---

## DNS manuel (au cas où tu veux le faire à la main, normalement inutile)

Si Cloudflare ne crée pas le record automatiquement :

| Type   | Name (Host) | Target (Value)        | Proxy (☁️) | TTL  |
|--------|-------------|------------------------|------------|------|
| AAAA   | `api`       | `100::`                | Proxied ✅ | Auto |

(L'IPv6 `100::` est l'IP discard. Cloudflare l'utilise pour les routes Workers
sans backend physique.)

---

## Si la preview URL change (futurs forks de session)
1. Reviens dans le Worker, change la constante `BACKEND` en haut du fichier
2. **Save and Deploy**
3. ✅ L'app sur tous les devices continue de marcher SANS REBUILD

---

## Côté app (déjà géré dans v2.4)
- `REACT_APP_BACKEND_URL=https://api.trykolo.io` (set dans `codemagic.yaml` + `.env.production`)
- Mécanisme runtime de fallback : si l'URL principale échoue, l'app teste 3 URLs alternatives et garde celle qui répond. Tu ne devrais **plus jamais** voir un 404.
