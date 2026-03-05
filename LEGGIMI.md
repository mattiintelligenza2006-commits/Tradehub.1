# TradeHub — Trading Dashboard

Dashboard personale per il monitoraggio dei mercati e diario di trading.

## Come pubblicare su GitHub Pages

### Passo 1: Crea un repository su GitHub
1. Vai su [github.com/new](https://github.com/new)
2. Nome del repository: `tradehub` (o quello che preferisci)
3. Metti **Public** (necessario per GitHub Pages gratuito)
4. NON aggiungere README, .gitignore o licenza (li abbiamo già)
5. Clicca **Create repository**

### Passo 2: Carica i file
1. Nella pagina del nuovo repository, clicca **"uploading an existing file"**
2. Trascina TUTTI i file della cartella `tradehub-github` nella finestra:
   - `index.html`
   - `app.js`
   - `base.css`
   - `style.css`
   - `manifest.json`
   - `icon-180.png`
   - `icon-192.png`
   - `icon-192.svg`
3. Scrivi un messaggio tipo "TradeHub prima versione"
4. Clicca **Commit changes**

### Passo 3: Attiva GitHub Pages
1. Vai nelle **Settings** del repository (icona ingranaggio in alto)
2. Nel menu a sinistra, clicca **Pages**
3. In "Source" seleziona **Deploy from a branch**
4. In "Branch" seleziona **main** e cartella **/ (root)**
5. Clicca **Save**
6. Aspetta 1-2 minuti — il sito sarà disponibile a:
   `https://TUO-USERNAME.github.io/tradehub/`

### Funzionalità
- 📰 **Notizie** — Notizie finanziarie da più fonti con verifica incrociata
- 🌍 **Geopolitica** — Conflitti attivi e impatto sui mercati
- 📊 **Asset** — Prezzi, supporti/resistenze, sentiment per XAU/USD e altri
- 📒 **Diario Trading** — Registra operazioni BUY/SELL con P/L automatico, grafici mensili

### Note importanti
- I dati del diario di trading vengono salvati nel **localStorage del browser**
- Questo significa che i tuoi dati restano nel browser che usi
- Se cambi browser o cancelli i dati del browser, le operazioni salvate andranno perse
- Per sicurezza, annota le operazioni importanti anche altrove

### Aggiornare il sito
Per aggiornare il sito, vai nel repository, clicca sul file da modificare, poi sull'icona matita per editarlo, e infine "Commit changes".
