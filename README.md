# GenZ Cafe — Code Copy

Ye tumhari GenZ Cafe website ki **code copy** hai — plain files mein, jo tum apne
computer ya apni hosting par khud chala sakte ho. Ye Muse wali live website se
alag, ek fresh copy hai; uska data (customers/points/orders) isme nahi aaya hai.

## Files

| File | Kya hai |
|---|---|
| `server.js` | Poora server — Node.js ke sirf built-in modules, koi `npm install` nahi chahiye |
| `public/index.html` | Poori website (design + saara front-end code ek hi file mein) |
| `package.json` | Sirf naam/start command — hosting ko `node server.js` chalane ke liye |
| `supabase-setup.sql` | Online database (Supabase) mode ke liye ek baar chalane wala SQL — neeche dekho |
| `data.json` | Pehli baar chalane par khud ban jayega — saara data (menu, customers, orders, points, settings) isi mein save hota hai (sirf local mode mein; Supabase mode mein data online rehta hai) |

## Chalana Kaise Hai

1. **Node.js install karo** — https://nodejs.org se LTS version download karke
   install kar lo (Windows/Mac/Linux sab par chalta hai).
2. Is folder mein terminal / command prompt kholo.
3. Command chalao:

   ```
   node server.js
   ```

4. Browser mein kholo: **http://localhost:3000**

Bas! Koi aur setup nahi hai.

## Pehli Baar — Admin Password Set Karo

- Pehli baar kholne par **Admin Login** wale hisse mein
  "🔑 Naya Admin Password Set Karo" form dikhega.
- Apna password banao (kam se kam 6 characters) — ye sirf ek baar hota hai,
  uske baad sirf wahi password chalega.
- Password server par hash karke save hota hai — plain text mein kahin nahi rehta.
- Baad mein password badalna ho to Admin → Settings → "Admin Password Badlo".

## Customer Kaise Use Karega

- Pehli screen par Google/Apple button (is copy mein ye **demo** hai — button
  dabane par setup form khulta hai: naam, mobile, password).
- Agli baar se customer seedha **mobile + password** se login karega.
- Galat number aur galat password ke alag-alag message aate hain.
- Har ₹100 ke order par 10 points; 200 points = 1 free dish.

## Admin Kya-Kya Kar Sakta Hai

- **Menu Edit** — dish add/edit/delete, Available/Band switch, discount
  (MRP + % dalo, discounted price khud ban jayegi), dish ki photo upload.
- **Offers** — festival/deal post add/edit/delete, on/off switch, poster upload.
  Chalu offers customer ko menu ke upar "🎁 Aaj Ke Offers" mein dikhte hain.
- **Kitchen** — saare orders, status aage badhao (Placed → Preparing → Ready →
  Served), Paid mark karo.
- **Customers** — saare customers aur unke points.
- **Settings** — Wi-Fi naam/password (customer ko Fun Zone mein dikhta hai),
  admin password badlo.

## Photo Upload

Admin dish ya offer form mein photo choose kar sakta hai. Photo browser mein
khud chhoti (max 800px) hokar save hoti hai, isliye `data.json` zyada bada nahi
hota aur page tez khulta hai.

## Online Database Mode (Supabase) — Data Hamesha Safe

Free hosting (jaise Render free) par `data.json` file reset ho sakti hai — isse
bachne ke liye data ek **free online database (Supabase)** mein rakho. Website
hosting par rahegi, data Supabase mein — hosting so jaye, restart ho ya dobara
deploy ho, customers/points/orders bilkul safe rahenge.

Setup (sirf ek baar):

1. **Supabase par free account banao** — https://supabase.com par sign up karke
   ek **naya project** banao (2 minute lagte hain, paisa nahi lagta).
2. **Table banao** — Supabase dashboard mein **SQL Editor** kholo aur
   `supabase-setup.sql` file wala poora SQL wahan paste karke **Run** dabao.
3. **Keys lo** — Supabase dashboard → **Project Settings → API** se do cheezein
   copy karo: **Project URL** aur **service_role key** (secret wali).
4. **Hosting mein daalo** — apni hosting (jaise Render) ke **Environment**
   settings mein ye do variables daalo:
   - `SUPABASE_URL` = Project URL
   - `SUPABASE_SERVICE_KEY` = service_role key
5. Server restart/redeploy karo — bas! Server start hote hi khud Supabase se
   data load karega (pehli baar sample menu khud seed ho jayega).

⚠️ **Keys ko kabhi public jagah ya chat mein mat daalo** — service_role key
tumhare database ki master chaabi hai. Ye sirf hosting ke Environment
settings mein rehni chahiye.

Note: Agar ye dono env variables nahi daale, to server pehle ki tarah local
`data.json` file mein hi data rakhega — kuch tootega nahi.

## Hosting Par Dalna Ho To

- Koi bhi **Node.js hosting** chalegi (jaise Render, Railway, VPS, ya ghar ka
  computer bhi).
- Sirf do cheezein upload karni hain: `server.js` aur `public/` folder.
- Start command: `node server.js`
- Port hosting wala khud deta hai to koi baat nahi — server `PORT` environment
  variable khud padh leta hai.
- ⚠️ **Dhyaan do:** local mode mein saara data `data.json` file mein save hota
  hai. Hosting par file delete/reset hui to data bhi jayega — isliye ya to
  time-time par `data.json` ka backup lete rehna, ya upar wala **Supabase
  online database mode** on kar lena (usme ye tension hi nahi hai).
- Hosting par dalne ke baad jo link milega, usi ka QR bana kar table par laga
  sakte ho.

## Ek Zaroori Baat

- Google/Apple login is copy mein **demo** hai (asli Google/Apple login ke liye
  unke developer account aur setup lagta hai — dukaan launch ke time hoga).
- Menu mein pehle se ~14 sample dishes hain — admin login karke apna asli menu
  edit/add/delete kar lena, bilkul aasan hai.

Koi dikkat aaye to Baby (Muse) ko bol dena — is code mein badlav kar dunga. 😊
