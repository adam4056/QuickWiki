# SHRNUTÍ PRO PRÁVNÍKA - QuickWiki

## 📋 Základní informace o aplikaci
- **Název**: QuickWiki
- **Typ**: Webová aplikace pro AI shrnutí článků z Wikipedie
- **Cílová skupina**: Veřejnost (bez registrace)
- **Model**: Freemium (zdarma)
- **Licence**: Open Source (ISC)

## 🔧 Technické fungování

### 1. Architektura aplikace
- **Frontend**: HTML/CSS/JavaScript (statická webová stránka)
- **Backend**: Serverless API (Vercel Functions)
- **Hosting**: Vercel platforma
- **Styling**: Tailwind CSS (lokální build)

### 2. Zpracování dat
```
Uživatel zadá dotaz → Wikipedia API → Groq AI API → Shrnutí → Zobrazení uživateli
```

### 3. Externí API služby
- **Wikipedia API**: Získání obsahu článků
  - Endpoint: `https://en.wikipedia.org/w/api.php`
  - Data: Název článku, textový obsah
  - Licence: Creative Commons

- **Groq AI API**: Generování shrnutí
  - Endpoint: `https://api.groq.com/openai/v1/chat/completions`
  - Model: `meta-llama/llama-4-scout-17b-16e-instruct`
  - Data: Text článku → AI shrnutí

## 📊 Shromažďování a zpracování dat

### Data na serveru (API)
- **Vyhledávací dotazy**: Termíny zadané uživatelem
- **Nastavení délky**: Preference pro počet vět (2-7)
- **Technické logy**: IP adresa, timestamp, chybové zprávy
- **API klíče**: Groq API key (environment variable)

### Data v prohlížeči (localStorage)
- **Historie vyhledávání**: Seznam posledních dotazů (max 50)
- **Cache shrnutí**: Uložená shrnutí pro rychlejší načítání (24h platnost)
- **Statistiky**: Počet vyhledávání, cache hit rate

### Data, která se NESHROMAŽĎUJÍ
- Osobní údaje (jméno, email, telefon)
- Přihlašovací údaje
- Cookies pro sledování
- Finanční informace

## 🔒 Bezpečnost a ochrana dat

### Šifrování
- HTTPS pro všechna data v přenosu
- API klíče uložené v environment variables

### Anonymizace
- API volání neobsahují osobní identifikátory
- IP adresy se logují pouze pro technické účely
- Žádné propojení s uživatelskými účty

### Ukládání dat
- Server: Dočasné logy (automatické mazání)
- Prohlížeč: Lokální úložiště (uživatel může vymazat)

## 🌍 Mezinárodní aspekty

### Teritoriální působnost
- Globální dostupnost
- Hlavní jazyk: Angličtina (Wikipedia API)
- Podporované jazyky: 50+ (podle Wikipedie)

### GDPR compliance
- Minimální shromažďování dat
- Lokální zpracování v prohlížeči
- Právo na vymazání (clear localStorage)
- Žádné cookies ani sledování

## ⚖️ Právní rizika a povinnosti

### Autorská práva
- Respektování Creative Commons licence Wikipedie
- Uvádění zdrojů (odkazy na původní články)
- Disclaimery o přesnosti AI shrnutí

### Odpovědnost
- Služba "as is" bez záruk
- Není odpovědnost za obsah Wikipedie
- Není odpovědnost za přesnost AI shrnutí

### Regulační požadavky
- GDPR: Minimální shromažďování dat
- E-privacy: Žádné cookies
- AI regulace: Transparentnost o použití AI

## 📝 Doporučené právní klauzule

### Terms of Use
- Přijetí podmínek používáním
- Omezení odpovědnosti za AI obsah
- Respektování autorských práv
- Právo na změnu podmínek

### Privacy Policy
- Minimální shromažďování dat
- Lokální zpracování v prohlížeči
- Anonymní API volání
- Právo na vymazání dat
- Žádné cookies ani sledování

## 🔗 Externí závislosti
- **Wikipedia**: Creative Commons licence
- **Groq AI**: API Terms of Service
- **Vercel**: Hosting Terms of Service

## 📞 Kontakt pro právníka
- **GitHub**: Pro technické dotazy
- **Email**: Pro právní komunikaci (doporučuji vytvořit)
- **Sídlo**: Pro oficiální korespondenci

---

**Toto shrnutí obsahuje všechny technické detaily potřebné pro vypracování právních dokumentů. Právník by měl zohlednit zejména GDPR compliance, autorská práva a odpovědnost za AI-generovaný obsah.** 