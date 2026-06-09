const Database = require('better-sqlite3');
const path = require('path');
const db = new Database(path.join(__dirname, 'tohfa.db'));

const sellerId = 155; // seller@test.com

const dummyProducts = [
  {
    name: 'Hand-Glazed Sage Bowl',
    price_paise: 125000,
    category_id: 3,
    description: 'A beautiful, irregular hand-glazed ceramic bowl in a soft sage green color, resting on a rustic wooden surface. The bowl features a crackled glaze effect and organic edges, shot in high-key natural light that emphasizes its tactile quality and delicate form. The aesthetic is clean and artisanal.',
    ships_in_days: 3,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAIlZOjtxc_awe6tB5cz4EzanNjyBomxKGOpkGYUUr5ckbOrtFYrKYpeccBhCBSS3rRDYVmzsVp0BLVS_xN6ptVyFFR_UD6CW74SwQba2McXT16SThooJEXQyLl9tBzARbYexiR5z9F4CmFxu8xLreOCuTlxZ_c_INC6FLdX3SOOQq1tpLdc88ZxTSM0JrdqQQ8LFQmSIld-XRV4K7hdh--fm4rxGAiz6D9mpa2aotyHUP1PqSp5jTNHSTmzV4KZ5kdCftK8stcJ4M'
  },
  {
    name: 'Oak & Ash Board',
    price_paise: 280000,
    category_id: 8,
    description: 'A solid oak wooden serving board with an artisan bread loaf placed upon it, shot in warm, golden afternoon light that brings out the deep wood grain. The scene is rustic yet refined, capturing a cozy home-kitchen moment. High contrast lighting with soft shadows creates a physical, tactile feel.',
    ships_in_days: 7,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuC_RsH84rsLEhM9BhLqf1idDkj9dAbsbvMWZm1SqRABQA5zGpp3AvnJYMN4jzOXyu2Z6UxLqk9xhPIBs0mqlmiYSuth4kFJtMBQ8BZ6n08IWirhsJ74pgdM8Anrf2Qh9w4em9nIyPxApBoGj-MtilGIYtF3E9TMFE8UkzwGqRGO-5mTBTEqvzW7VHc85X-GD-4zAgnl78uP-9_ShxzVoxB7JQp1pNLdLzjmno8hE3TIsYu3SF_3JpBC0a4uaozm9mhcdB0i0DRolb8'
  },
  {
    name: 'Lavender Pendant',
    price_paise: 95000,
    category_id: 2,
    description: 'A delicate handmade lavender resin pendant with real dried petals suspended inside, hanging from a thin gold chain. The pendant is displayed on a soft velvet cushion in a pale violet hue. The lighting is soft and flattering, highlighting the crystalline clarity of the resin and the intricate botanical details.',
    ships_in_days: 2,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAP4kU2c8zbx4Xaol1rHDXI_iQiG8J2VXxxvB-jzbLh_XTIhVyBTF0TsI0T85eqe7OWH7Vh2i2vnE9UYGBtNJVI_4euqnjUlXXTzpWi4NIKzegZuDo2Edf2dgu20_nJidPl9QurGAUZlQdGVpom5Y4YQLX496AgUJp3ydVNQpz8uDDSoA2iY7LdUF3_loB89opdKsqtrvhcyBUOQZhiY-ELrhBYU5ewxsTH2ux2_01NvbyYUvGoWnWy2MinnnRcuoz3sC3V766VCRA'
  },
  {
    name: 'Botanical Wraps',
    price_paise: 65000,
    category_id: 1,
    description: 'A stack of hand-dyed organic cotton beeswax wraps featuring delicate leaf patterns in sage and ochre. The fabric stack is tied with a simple jute twine, resting on a clean white linen surface. The visual style is light and airy, emphasizing sustainability and hand-made charm with a high-key light mode aesthetic.',
    ships_in_days: 4,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAMJAxNgTh5SJQTRbeAoTilAZbugJo12R1x1plpxilDvUf5fwGA44tDsI1Xqln-3-lTYYk6Qfp8vlZk9EZnZ6XAwPx6JpMpic1kEYQeJPc6D4as7Xfvs3Qn2wDySy4HvervTSdrLLIyjlzH4D4viyX6aCUeg5JhYRYg37m_8X_dwEUM4jgVsyP4aBq8mw6s-2A2naomsiwsFD-sZxPK6NG8Hd3OKI-JexWyt2_7hFj3fhjsdeQHkhRyI9nTXGWFoAdtsRMHiGTqiDc'
  },
  {
    name: 'Wool Throw Blanket',
    price_paise: 450000,
    category_id: 1,
    description: 'A luxurious, thick woven organic wool throw blanket in earthy cream and grey tones, draped over a modern wooden armchair. Sunbeam from a window highlights the soft, fluffy texture of the wool. Minimalist Scandinavian style.',
    ships_in_days: 5,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAU5MKh32XiupvdvJAge7v9Dd8A-5IczTYjRKRjG_XmvlMsZkdqixkrIKJbYnO2hoUc4igYoj1oyZ-xGYbyiq8tPkQ8I1ObKuyeYTTn_6CR5Yhm-3TSWGVsoeWvATRWJ8g6qqKHV-8_lbwKc8SClRFaPG-HoTK0tyc9GmDXv-2Ewdab_Unod1jBi4yQML44DvbOQ1w3DwvPun88ufsHaqViBpxgqJd8P2MQCfJIF2H_RxaVf3OmFOZuV3y5oxxqLxSeSaYZVPcZJGY'
  },
  {
    name: 'Leather Journal',
    price_paise: 185000,
    category_id: 4,
    description: 'A vintage-style hand-bound dark brown leather journal resting on a wooden writing desk, alongside a classic calligraphy fountain pen. The leather has a weathered, rich texture with visible stitching details.',
    ships_in_days: 2,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAekO-e4Z9Kym-whZp3YzQjbeE59qwgo2jNvGw3G9dGQwoh2E_IcfvQztke526ZVoXyb33LsS-l6muEHwgQ-VhFICrD0UvBDQbYn-QsLbsQJyjwVivEwa9ewqvOlp9kf6SePxG7SmPGlU-ZEzxf1YItlN0AiEOnKDA5OG-1vHX2WDFCpDodVzxiD9sR-nEWWMRQ31u5b6xAB4_qOlDQDfWTXiyukP8Q9NKv6A3amWKhBPppUf2OGSxtI1WDCfEZkvU-eN_UmPOdrMo'
  },
  {
    name: 'Soy Lavender Candle',
    price_paise: 75000,
    category_id: 5,
    description: 'A hand-poured soy wax candle in an amber glass jar, with lavender sprigs resting nearby. The warm flame of the candle creates a cozy and relaxing ambient light.',
    ships_in_days: 3,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDxJ5YDdesnrhfeluH3CqQNZ0Juy5CkgPLRx_Izr7rs0-A0p8Y45R6ekYKyIezhwPBATWtvuv1V7C6pDMLW9IS8axurKFlKOZa_LcZ88uT6ua55ipNAd6UAVZs7H3J17latC_ErfZTWBJZxX7GHcm6VF64gaOywMkbUiEquZK6Yp-prtITyz24gvZr7cpnPMGGEmjS0JabjCjGb5LWjlUnL37UOG6KGAvY4RNawvgNHL2X5ztgaXDJyAkjnjcSO489QzJ9dZYkLr0'
  },
  {
    name: 'Abstract Art Print',
    price_paise: 150000,
    category_id: 11,
    description: 'An abstract watercolor floral painting in soft pastel pinks and greens, framed in a clean light-colored wooden frame, hanging on a white wall in natural light.',
    ships_in_days: 4,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBjDcLug000FlfJ3E5G3_AOIfAhQJ5cVI2PtwtmWa66LetQhs4LC6kwIVPd0PXzRUq--jqVerh3aa81JK1ChSre9ZTCvV3MaV0ZJmL5IoOADQqhgX1oWecSDR1D-12taTalWsaFXR-KGhJIqX6efYrSCoCJCmvY1tFw30KEoI6woKKBkjYj7sBIFlKAJkRgvcqvxv_hdcMCYFY-o6kBa-MwPZjK20tCW6R01csBFgXJt5Avqi81HJYXpf8EVa74lqkQlWN64na5y5o'
  },
  {
    name: 'Ceramic Tea Mug Set',
    price_paise: 220000,
    category_id: 3,
    description: 'A pair of beautifully matched ceramic tea mugs with an earthy dual-tone brown and cream glaze, steam gently rising from hot tea inside.',
    ships_in_days: 3,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBkNApOvwUZyNOP6tzGFWd7AgYYosGJ1xzLnjvDc0YAQhRfgxRNzvPNfTLADyHiu0_ldNx74UMc29QrxIbP319f3AxpCh14jItkvCgcV1ULR8MYWcYM4CEWLRe6px-CGhKZSdMMS2ffBYE0Di1EvKysgGIlr522IfxJvhW3t70pFIHqbCca6NTK-RCfSHGnWGpFN3-cQF1huori20XyXxQSUFEf7Nu-7CA6byxamj7mgoYIM5vjeiNemqrWuaD6LdX_DauHQwN6bZs'
  },
  {
    name: 'Wildflower Silver Ring',
    price_paise: 310000,
    category_id: 2,
    description: 'A delicate sterling silver ring featuring a detailed wildflower engraving, shown close up on a hand in natural sunlight.',
    ships_in_days: 5,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAU5MKh32XiupvdvJAge7v9Dd8A-5IczTYjRKRjG_XmvlMsZkdqixkrIKJbYnO2hoUc4igYoj1oyZ-xGYbyiq8tPkQ8I1ObKuyeYTTn_6CR5Yhm-3TSWGVsoeWvATRWJ8g6qqKHV-8_lbwKc8SClRFaPG-HoTK0tyc9GmDXv-2Ewdab_Unod1jBi4yQML44DvbOQ1w3DwvPun88ufsHaqViBpxgqJd8P2MQCfJIF2H_RxaVf3OmFOZuV3y5oxxqLxSeSaYZVPcZJGY'
  },
  {
    name: 'Macrame Wall Hanging',
    price_paise: 195000,
    category_id: 8,
    description: 'A modern macrame wall hanging with intricate knot patterns, suspended from a natural driftwood branch on a neutral wall.',
    ships_in_days: 6,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuAekO-e4Z9Kym-whZp3YzQjbeE59qwgo2jNvGw3G9dGQwoh2E_IcfvQztke526ZVoXyb33LsS-l6muEHwgQ-VhFICrD0UvBDQbYn-QsLbsQJyjwVivEwa9ewqvOlp9kf6SePxG7SmPGlU-ZEzxf1YItlN0AiEOnKDA5OG-1vHX2WDFCpDodVzxiD9sR-nEWWMRQ31u5b6xAB4_qOlDQDfWTXiyukP8Q9NKv6A3amWKhBPppUf2OGSxtI1WDCfEZkvU-eN_UmPOdrMo'
  },
  {
    name: 'Organic Herb Garden Kit',
    price_paise: 110000,
    category_id: 7,
    description: 'An organic herb garden starter kit with small clay pots, seeds, and soil pellets on a kitchen counter.',
    ships_in_days: 2,
    imageUrl: 'https://lh3.googleusercontent.com/aida-public/AB6AXuBDxJ5YDdesnrhfeluH3CqQNZ0Juy5CkgPLRx_Izr7rs0-A0p8Y45R6ekYKyIezhwPBATWtvuv1V7C6pDMLW9IS8axurKFlKOZa_LcZ88uT6ua55ipNAd6UAVZs7H3J17latC_ErfZTWBJZxX7GHcm6VF64gaOywMkbUiEquZK6Yp-prtITyz24gvZr7cpnPMGGEmjS0JabjCjGb5LWjlUnL37UOG6KGAvY4RNawvgNHL2X5ztgaXDJyAkjnjcSO489QzJ9dZYkLr0'
  }
];

const results = {};

for (const p of dummyProducts) {
  // Check if product exists
  let existing = db.prepare('SELECT id FROM products WHERE name = ? AND seller_id = ?').get(p.name, sellerId);
  let productId;
  if (!existing) {
    // Insert
    const info = db.prepare(`
      INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status, avg_rating, review_count)
      VALUES (?, ?, ?, ?, ?, 10, ?, 'active', 4.5, 0)
    `).run(sellerId, p.category_id, p.name, p.description, p.price_paise, p.ships_in_days);
    
    productId = info.lastInsertRowid;
    
    // Insert image
    db.prepare(`
      INSERT INTO product_images (product_id, url, is_primary, sort_order)
      VALUES (?, ?, 1, 0)
    `).run(productId, p.imageUrl);
    
    console.log(`[SEED] Created product "${p.name}" with ID: ${productId}`);
  } else {
    productId = existing.id;
    console.log(`[SEED] Product "${p.name}" already exists with ID: ${productId}`);
  }
  results[p.name] = productId;
}

console.log('\n--- MAPPING RESULT ---');
console.log(JSON.stringify(results, null, 2));
