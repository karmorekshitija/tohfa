// Set port to 5001 for part 1 tests
process.env.PORT = 5001;

const { server } = require('./src/server');
const db = require('./src/db');

async function runTests() {
  console.log('=== RUNNING TOHFA PART 1 INTEGRATION TESTS ===');
  const baseUrl = 'http://localhost:5001';
  let exitCode = 0;
  
  try {
    // Clear tables
    db.prepare('DELETE FROM follows').run();
    db.prepare('DELETE FROM saved_reels').run();
    db.prepare('DELETE FROM reel_comments').run();
    db.prepare('DELETE FROM reel_likes').run();
    db.prepare('DELETE FROM reels').run();
    db.prepare('DELETE FROM wishlists').run();
    db.prepare('DELETE FROM reviews').run();
    db.prepare('DELETE FROM order_items').run();
    db.prepare('DELETE FROM orders').run();
    db.prepare('DELETE FROM addresses').run();
    db.prepare('DELETE FROM cart_items').run();
    db.prepare('DELETE FROM product_images').run();
    db.prepare('DELETE FROM products').run();
    db.prepare('DELETE FROM refresh_tokens').run();
    db.prepare('DELETE FROM seller_profiles').run();
    db.prepare('DELETE FROM users').run();

    // Reset categories (handled automatically by db.js, let's verify)
    const categoryCount = db.prepare('SELECT COUNT(*) as count FROM categories').get().count;
    if (categoryCount === 0) {
      throw new Error('Categories were not seeded correctly');
    }
    console.log(`Seeded categories count: ${categoryCount}`);

    // Create a buyer and a seller for testing
    const buyerRegisterRes = await fetch(`${baseUrl}/api/auth/register/buyer`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Buyer',
        email: 'buyer@test.com',
        password: 'password123'
      })
    });
    const buyerData = await buyerRegisterRes.json();
    if (buyerRegisterRes.status !== 201) {
      throw new Error(`Failed to create test buyer: ${JSON.stringify(buyerData)}`);
    }
    const buyerToken = buyerData.data.access_token;
    const buyerId = buyerData.data.user.id;

    const sellerRegisterRes = await fetch(`${baseUrl}/api/auth/register/seller`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name: 'Test Seller',
        email: 'seller@test.com',
        password: 'password123',
        shop_name: 'Stoneware Studio',
        ships_in_days: 2
      })
    });
    const sellerData = await sellerRegisterRes.json();
    if (sellerRegisterRes.status !== 201) {
      throw new Error(`Failed to create test seller: ${JSON.stringify(sellerData)}`);
    }
    const sellerToken = sellerData.data.access_token;
    const sellerId = sellerData.data.user.id;

    console.log(`Created test buyer ID: ${buyerId}, seller ID: ${sellerId}`);

    // --- TASK 15 TESTS: GET /api/home/feed ---
    console.log('--- Testing TASK 15: GET /api/home/feed ---');
    const feedRes = await fetch(`${baseUrl}/api/home/feed`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Feed Status:', feedRes.status);
    const feedData = await feedRes.json();
    if (feedRes.status !== 200 || !feedData.success || !feedData.data.greeting || !Array.isArray(feedData.data.featured_products) || !Array.isArray(feedData.data.categories)) {
      throw new Error(`Feed response invalid: ${JSON.stringify(feedData)}`);
    }
    console.log('✓ Task 15 Passed: GET /api/home/feed');

    // --- TASK 16 TESTS: GET /api/categories ---
    console.log('--- Testing TASK 16: GET /api/categories ---');
    const catRes = await fetch(`${baseUrl}/api/categories`);
    console.log('Categories Status:', catRes.status);
    const catData = await catRes.json();
    if (catRes.status !== 200 || !catData.success || !Array.isArray(catData.data.categories) || catData.data.categories.length !== 8) {
      throw new Error(`Categories response invalid: ${JSON.stringify(catData)}`);
    }
    console.log('✓ Task 16 Passed: GET /api/categories');

    // --- TASK 17 TESTS: GET /api/categories/:slug/products ---
    console.log('--- Testing TASK 17: GET /api/categories/:slug/products ---');
    // We need to insert a product to test the category products list
    const ceramicsCategory = db.prepare("SELECT id FROM categories WHERE slug = 'ceramics-pottery'").get();
    db.prepare(`
      INSERT INTO products (seller_id, category_id, name, description, price_paise, stock_qty, ships_in_days, status)
      VALUES (?, ?, 'Speckled Moon Bowl', 'Handmade clay bowl', 4800, 5, 1, 'active')
    `).run(sellerId, ceramicsCategory.id);
    const newProductId = db.prepare("SELECT last_insert_rowid() as id").get().id;
    
    // Insert an image for the product
    db.prepare(`
      INSERT INTO product_images (product_id, url, is_primary)
      VALUES (?, 'https://example.com/image.jpg', 1)
    `).run(newProductId);

    const catProdRes = await fetch(`${baseUrl}/api/categories/ceramics-pottery/products`);
    console.log('Category Products Status:', catProdRes.status);
    const catProdData = await catProdRes.json();
    if (catProdRes.status !== 200 || !catProdData.success || catProdData.data.products.length !== 1) {
      throw new Error(`Category Products response invalid: ${JSON.stringify(catProdData)}`);
    }
    const product = catProdData.data.products[0];
    if (product.name !== 'Speckled Moon Bowl' || product.price_paise !== 4800 || product.ready_to_ship !== true || product.image_url !== 'https://example.com/image.jpg') {
      throw new Error(`Product fields mismatch in category feed: ${JSON.stringify(product)}`);
    }

    // Test nonexistent category slug (404)
    const nonexistentCatProdRes = await fetch(`${baseUrl}/api/categories/nonexistent-slug/products`);
    console.log('Nonexistent Category Products Status:', nonexistentCatProdRes.status);
    const nonexistentCatProdData = await nonexistentCatProdRes.json();
    if (nonexistentCatProdRes.status !== 404 || nonexistentCatProdData.code !== 'CATEGORY_NOT_FOUND') {
      throw new Error(`Expected 404 with CATEGORY_NOT_FOUND, got ${nonexistentCatProdRes.status}`);
    }

    console.log('✓ Task 17 Passed: GET /api/categories/:slug/products');

    // --- TASK 18 TESTS: GET /api/products/search ---
    console.log('--- Testing TASK 18: GET /api/products/search ---');
    // Test valid search query
    const searchRes = await fetch(`${baseUrl}/api/products/search?q=Moon`);
    console.log('Search Status:', searchRes.status);
    const searchData = await searchRes.json();
    if (searchRes.status !== 200 || !searchData.success || searchData.data.query !== 'Moon' || searchData.data.products.length !== 1) {
      throw new Error(`Search response invalid: ${JSON.stringify(searchData)}`);
    }
    const searchProduct = searchData.data.products[0];
    if (searchProduct.name !== 'Speckled Moon Bowl' || searchProduct.price_paise !== 4800 || searchProduct.seller_name !== 'Stoneware Studio' || searchProduct.image_url !== 'https://example.com/image.jpg') {
      throw new Error(`Search product fields mismatch: ${JSON.stringify(searchProduct)}`);
    }

    // Test missing query param q
    const missingSearchRes = await fetch(`${baseUrl}/api/products/search`);
    console.log('Missing Search Status:', missingSearchRes.status);
    const missingSearchData = await missingSearchRes.json();
    if (missingSearchRes.status !== 400 || missingSearchData.code !== 'VALIDATION_ERROR') {
      throw new Error(`Expected 400 with VALIDATION_ERROR, got ${missingSearchRes.status}`);
    }

    console.log('✓ Task 18 Passed: GET /api/products/search');

    // --- TASK 19 TESTS: GET /api/products/:id ---
    console.log('--- Testing TASK 19: GET /api/products/:id ---');
    // Fetch product with valid ID
    const prodDetailRes = await fetch(`${baseUrl}/api/products/${newProductId}`);
    console.log('Product Details Status:', prodDetailRes.status);
    const prodDetailData = await prodDetailRes.json();
    if (prodDetailRes.status !== 200 || !prodDetailData.success) {
      throw new Error(`Product details fetch failed: ${JSON.stringify(prodDetailData)}`);
    }
    const prodDetails = prodDetailData.data;
    if (prodDetails.name !== 'Speckled Moon Bowl' || prodDetails.price_paise !== 4800 || prodDetails.seller.seller_name !== 'Stoneware Studio' || prodDetails.category.slug !== 'ceramics-pottery' || prodDetails.is_wishlisted !== false) {
      throw new Error(`Product details mismatch: ${JSON.stringify(prodDetails)}`);
    }

    // Insert a review to test recent_reviews
    db.prepare(`
      INSERT INTO reviews (product_id, reviewer_id, rating, body)
      VALUES (?, ?, 5, 'Absolutely perfect!')
    `).run(newProductId, buyerId);

    // Fetch product with review, authenticated to check is_wishlisted after wishlisting
    db.prepare(`INSERT INTO wishlists (user_id, product_id) VALUES (?, ?)`).run(buyerId, newProductId);

    const authProdDetailRes = await fetch(`${baseUrl}/api/products/${newProductId}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Auth Product Details Status:', authProdDetailRes.status);
    const authProdDetailData = await authProdDetailRes.json();
    if (authProdDetailRes.status !== 200 || !authProdDetailData.success) {
      throw new Error(`Auth product details fetch failed: ${JSON.stringify(authProdDetailData)}`);
    }
    const authProdDetails = authProdDetailData.data;
    if (authProdDetails.is_wishlisted !== true || authProdDetails.recent_reviews.length !== 1 || authProdDetails.recent_reviews[0].reviewer_name !== 'Test Buyer') {
      throw new Error(`Auth product details mismatch: ${JSON.stringify(authProdDetails)}`);
    }

    // Update stock to 0 and verify status becomes 'sold_out'
    db.prepare("UPDATE products SET stock_qty = 0 WHERE id = ?").run(newProductId);
    const soldOutRes = await fetch(`${baseUrl}/api/products/${newProductId}`);
    const soldOutData = await soldOutRes.json();
    if (soldOutData.data.status !== 'sold_out') {
      throw new Error(`Expected status to be 'sold_out', got: ${soldOutData.data.status}`);
    }

    // Reset stock qty back
    db.prepare("UPDATE products SET stock_qty = 5 WHERE id = ?").run(newProductId);

    // Test nonexistent product (404)
    const nonexistentProdRes = await fetch(`${baseUrl}/api/products/999999`);
    console.log('Nonexistent Product Status:', nonexistentProdRes.status);
    const nonexistentProdData = await nonexistentProdRes.json();
    if (nonexistentProdRes.status !== 404 || nonexistentProdData.code !== 'PRODUCT_NOT_FOUND') {
      throw new Error(`Expected 404 with PRODUCT_NOT_FOUND, got ${nonexistentProdRes.status}`);
    }

    console.log('✓ Task 19 Passed: GET /api/products/:id');

    // --- TASK 20 TESTS: GET /api/cart ---
    console.log('--- Testing TASK 20: GET /api/cart ---');
    // Test unauthenticated
    const unauthCartRes = await fetch(`${baseUrl}/api/cart`);
    console.log('Unauth Cart Status:', unauthCartRes.status);
    if (unauthCartRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated cart access, got ${unauthCartRes.status}`);
    }

    // Insert cart item for buyer
    db.prepare(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES (?, ?, 1)
    `).run(buyerId, newProductId);

    // Fetch cart authenticated
    const cartRes = await fetch(`${baseUrl}/api/cart`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Cart Status:', cartRes.status);
    const cartData = await cartRes.json();
    if (cartRes.status !== 200 || !cartData.success) {
      throw new Error(`Cart fetch failed: ${JSON.stringify(cartData)}`);
    }
    const cart = cartData.data;
    if (cart.item_count !== 1 || cart.subtotal_paise !== 4800 || cart.shipping_paise !== 12000 || cart.total_paise !== 16800) {
      throw new Error(`Cart calculations mismatch: ${JSON.stringify(cart)}`);
    }

    // Update quantity to exceed stock to test quantity warning
    db.prepare(`UPDATE cart_items SET quantity = 10 WHERE user_id = ? AND product_id = ?`).run(buyerId, newProductId);
    const warningCartRes = await fetch(`${baseUrl}/api/cart`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const warningCartData = await warningCartRes.json();
    if (warningCartData.data.items[0].quantity_warning !== true) {
      throw new Error(`Expected quantity_warning to be true, got: ${warningCartData.data.items[0].quantity_warning}`);
    }

    // Restore quantity and test free shipping (subtotal >= 50000 paise)
    db.prepare(`UPDATE cart_items SET quantity = 11 WHERE user_id = ? AND product_id = ?`).run(buyerId, newProductId);
    // price = 4800, 4800 * 11 = 52800 paise > 50000 paise
    const freeShippingCartRes = await fetch(`${baseUrl}/api/cart`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const freeShippingCartData = await freeShippingCartRes.json();
    if (freeShippingCartData.data.shipping_paise !== 0 || freeShippingCartData.data.total_paise !== 52800) {
      throw new Error(`Expected free shipping, got shipping: ${freeShippingCartData.data.shipping_paise}`);
    }

    // Clean up cart for buyer for future tests
    db.prepare(`DELETE FROM cart_items WHERE user_id = ?`).run(buyerId);

    console.log('✓ Task 20 Passed: GET /api/cart');

    // --- TASK 21 TESTS: POST /api/cart/items ---
    console.log('--- Testing TASK 21: POST /api/cart/items ---');
    // Test valid add
    const addCartRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: newProductId, quantity: 2 })
    });
    console.log('Add to Cart Status:', addCartRes.status);
    const addCartData = await addCartRes.json();
    if (addCartRes.status !== 200 || !addCartData.success || !addCartData.data.cart_item_id || addCartData.data.item_count !== 2) {
      throw new Error(`Add to cart failed: ${JSON.stringify(addCartData)}`);
    }

    // Test duplicate add
    const dupAddRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: newProductId, quantity: 1 })
    });
    console.log('Duplicate Add Status:', dupAddRes.status);
    const dupAddData = await dupAddRes.json();
    if (dupAddRes.status !== 409 || dupAddData.code !== 'CART_ITEM_EXISTS') {
      throw new Error(`Expected 409 and CART_ITEM_EXISTS for duplicate add, got ${dupAddRes.status}: ${JSON.stringify(dupAddData)}`);
    }

    // Test exceeding stock qty (stock is 5, trying to add a new product with qty=6)
    // Insert new product with stock 5
    db.prepare(`
      INSERT INTO products (seller_id, category_id, name, price_paise, stock_qty, ships_in_days, status)
      VALUES (?, ?, 'Exceed Stock Product', 1000, 5, 2, 'active')
    `).run(sellerId, ceramicsCategory.id);
    const exceedStockProdId = db.prepare("SELECT last_insert_rowid() as id").get().id;

    const exceedStockRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: exceedStockProdId, quantity: 6 })
    });
    console.log('Exceed Stock Add Status:', exceedStockRes.status);
    const exceedStockData = await exceedStockRes.json();
    if (exceedStockRes.status !== 422 || exceedStockData.code !== 'INSUFFICIENT_STOCK') {
      throw new Error(`Expected 422 and INSUFFICIENT_STOCK, got ${exceedStockRes.status}`);
    }

    // Test invalid quantity
    const invalidQtyRes = await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: exceedStockProdId, quantity: 0 })
    });
    console.log('Invalid Qty Status:', invalidQtyRes.status);
    if (invalidQtyRes.status !== 400) {
      throw new Error(`Expected 400 for quantity=0, got ${invalidQtyRes.status}`);
    }

    console.log('✓ Task 21 Passed: POST /api/cart/items');

    // --- TASK 22 TESTS: PATCH /api/cart/items/:id ---
    console.log('--- Testing TASK 22: PATCH /api/cart/items/:id ---');
    // Get the cart item ID from the previous test
    const cartItemId = addCartData.data.cart_item_id;

    // Test valid PATCH update
    const patchRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ quantity: 3 })
    });
    console.log('Patch Status:', patchRes.status);
    const patchData = await patchRes.json();
    if (patchRes.status !== 200 || !patchData.success || patchData.data.quantity !== 3) {
      throw new Error(`PATCH failed: ${JSON.stringify(patchData)}`);
    }

    // Test PATCH exceeding stock (stock is 5)
    const patchExceedRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ quantity: 6 })
    });
    console.log('Patch Exceed Status:', patchExceedRes.status);
    if (patchExceedRes.status !== 422) {
      throw new Error(`Expected 422 for PATCH exceeding stock, got ${patchExceedRes.status}`);
    }

    // Test PATCH not owner (use sellerToken, who is a registered user)
    const patchUnauthRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ quantity: 2 })
    });
    console.log('Patch Not Owner Status:', patchUnauthRes.status);
    if (patchUnauthRes.status !== 403) {
      throw new Error(`Expected 403 for PATCH from non-owner, got ${patchUnauthRes.status}`);
    }

    // Test PATCH nonexistent cart item
    const patchNonexistentRes = await fetch(`${baseUrl}/api/cart/items/999999`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ quantity: 2 })
    });
    console.log('Patch Nonexistent Status:', patchNonexistentRes.status);
    if (patchNonexistentRes.status !== 404) {
      throw new Error(`Expected 404 for PATCH nonexistent item, got ${patchNonexistentRes.status}`);
    }

    console.log('✓ Task 22 Passed: PATCH /api/cart/items/:id');

    // --- TASK 23 TESTS: DELETE /api/cart/items/:id ---
    console.log('--- Testing TASK 23: DELETE /api/cart/items/:id ---');
    // Test unauthenticated DELETE
    const unauthDelRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'DELETE'
    });
    console.log('Unauth Delete Status:', unauthDelRes.status);
    if (unauthDelRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated DELETE, got ${unauthDelRes.status}`);
    }

    // Test DELETE not owner (using sellerToken)
    const notOwnerDelRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    console.log('Not Owner Delete Status:', notOwnerDelRes.status);
    if (notOwnerDelRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner DELETE, got ${notOwnerDelRes.status}`);
    }

    // Test DELETE nonexistent item
    const nonexistentDelRes = await fetch(`${baseUrl}/api/cart/items/999999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Nonexistent Delete Status:', nonexistentDelRes.status);
    if (nonexistentDelRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent DELETE, got ${nonexistentDelRes.status}`);
    }

    // Test valid DELETE
    const delRes = await fetch(`${baseUrl}/api/cart/items/${cartItemId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Delete Status:', delRes.status);
    const delData = await delRes.json();
    if (delRes.status !== 200 || !delData.success || delData.data.item_count !== 0) {
      throw new Error(`Valid DELETE failed: ${JSON.stringify(delData)}`);
    }

    console.log('✓ Task 23 Passed: DELETE /api/cart/items/:id');

    // --- TASK 24 TESTS: GET /api/addresses ---
    console.log('--- Testing TASK 24: GET /api/addresses ---');
    // Test unauthenticated GET
    const unauthAddRes = await fetch(`${baseUrl}/api/addresses`);
    console.log('Unauth Addresses Status:', unauthAddRes.status);
    if (unauthAddRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated addresses fetch, got ${unauthAddRes.status}`);
    }

    // Insert address via DB
    db.prepare(`
      INSERT INTO addresses (user_id, full_name, line1, line2, city, state, pincode, phone, is_default)
      VALUES (?, 'Arjun Varma', 'Flat 402, Lotus Residency', '12th Main Road, Indiranagar', 'Bangalore', 'KA', '560038', '+91 98765 43210', 1)
    `).run(buyerId);

    // Fetch addresses authenticated
    const addRes = await fetch(`${baseUrl}/api/addresses`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Addresses Status:', addRes.status);
    const addData = await addRes.json();
    if (addRes.status !== 200 || !addData.success || addData.data.addresses.length !== 1) {
      throw new Error(`Addresses fetch failed: ${JSON.stringify(addData)}`);
    }
    const address = addData.data.addresses[0];
    if (address.full_name !== 'Arjun Varma' || address.city !== 'Bangalore' || address.is_default !== 1) {
      throw new Error(`Address details mismatch: ${JSON.stringify(address)}`);
    }

    console.log('✓ Task 24 Passed: GET /api/addresses');

    // --- TASK 25 TESTS: POST /api/addresses ---
    console.log('--- Testing TASK 25: POST /api/addresses ---');
    // Test valid POST
    const postAddRes = await fetch(`${baseUrl}/api/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2',
        line1: 'Flat 505, Rose Wood',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        is_default: true
      })
    });
    console.log('Post Address Status:', postAddRes.status);
    const postAddData = await postAddRes.json();
    if (postAddRes.status !== 201 || !postAddData.success || postAddData.data.is_default !== 1 || postAddData.data.full_name !== 'Arjun Varma 2') {
      throw new Error(`POST address failed: ${JSON.stringify(postAddData)}`);
    }
    const newAddressId = postAddData.data.id;

    // Verify the first address was set to is_default = 0
    const checkAddRes = await fetch(`${baseUrl}/api/addresses`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const checkAddData = await checkAddRes.json();
    const prevAddress = checkAddData.data.addresses.find(a => a.full_name === 'Arjun Varma');
    if (!prevAddress || prevAddress.is_default !== 0) {
      throw new Error(`Expected previous address to have is_default=0, got: ${JSON.stringify(prevAddress)}`);
    }

    // Test invalid POST (missing line1)
    const invalidPostAddRes = await fetch(`${baseUrl}/api/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001'
      })
    });
    console.log('Invalid Post Address Status:', invalidPostAddRes.status);
    if (invalidPostAddRes.status !== 400) {
      throw new Error(`Expected 400 for invalid address POST, got ${invalidPostAddRes.status}`);
    }

    console.log('✓ Task 25 Passed: POST /api/addresses');

    // --- TASK 26 TESTS: PUT /api/addresses/:id ---
    console.log('--- Testing TASK 26: PUT /api/addresses/:id ---');
    // Test valid PUT
    const putAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2 Updated',
        line1: 'Flat 505, Rose Wood',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001',
        is_default: true
      })
    });
    console.log('Put Address Status:', putAddRes.status);
    const putAddData = await putAddRes.json();
    if (putAddRes.status !== 200 || !putAddData.success || putAddData.data.full_name !== 'Arjun Varma 2 Updated') {
      throw new Error(`PUT address failed: ${JSON.stringify(putAddData)}`);
    }

    // Test invalid PUT (missing city)
    const invalidPutAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2 Updated',
        line1: 'Flat 505, Rose Wood',
        state: 'MH',
        pincode: '400001'
      })
    });
    console.log('Invalid Put Address Status:', invalidPutAddRes.status);
    if (invalidPutAddRes.status !== 400) {
      throw new Error(`Expected 400 for invalid address PUT, got ${invalidPutAddRes.status}`);
    }

    // Test PUT not owner (using sellerToken)
    const notOwnerPutAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2 Updated',
        line1: 'Flat 505, Rose Wood',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001'
      })
    });
    console.log('Not Owner Put Address Status:', notOwnerPutAddRes.status);
    if (notOwnerPutAddRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner PUT address, got ${notOwnerPutAddRes.status}`);
    }

    // Test PUT nonexistent address
    const nonexistentPutAddRes = await fetch(`${baseUrl}/api/addresses/999999`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Arjun Varma 2 Updated',
        line1: 'Flat 505, Rose Wood',
        city: 'Mumbai',
        state: 'MH',
        pincode: '400001'
      })
    });
    console.log('Nonexistent Put Address Status:', nonexistentPutAddRes.status);
    if (nonexistentPutAddRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent PUT address, got ${nonexistentPutAddRes.status}`);
    }

    console.log('✓ Task 26 Passed: PUT /api/addresses/:id');

    // --- TASK 27 TESTS: DELETE /api/addresses/:id ---
    console.log('--- Testing TASK 27: DELETE /api/addresses/:id ---');
    // Test unauthenticated DELETE
    const unauthDelAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'DELETE'
    });
    console.log('Unauth Delete Address Status:', unauthDelAddRes.status);
    if (unauthDelAddRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated DELETE address, got ${unauthDelAddRes.status}`);
    }

    // Test DELETE not owner (using sellerToken)
    const notOwnerDelAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    console.log('Not Owner Delete Address Status:', notOwnerDelAddRes.status);
    if (notOwnerDelAddRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner DELETE address, got ${notOwnerDelAddRes.status}`);
    }

    // Test DELETE nonexistent address
    const nonexistentDelAddRes = await fetch(`${baseUrl}/api/addresses/999999`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Nonexistent Delete Address Status:', nonexistentDelAddRes.status);
    if (nonexistentDelAddRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent DELETE address, got ${nonexistentDelAddRes.status}`);
    }

    // Test valid DELETE
    const delAddRes = await fetch(`${baseUrl}/api/addresses/${newAddressId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Delete Address Status:', delAddRes.status);
    const delAddData = await delAddRes.json();
    if (delAddRes.status !== 200 || !delAddData.success) {
      throw new Error(`Valid DELETE address failed: ${JSON.stringify(delAddData)}`);
    }

    console.log('✓ Task 27 Passed: DELETE /api/addresses/:id');

    // --- TASK 28 TESTS: POST /api/orders ---
    console.log('--- Testing TASK 28: POST /api/orders ---');
    // We need an address and cart items to test orders
    const orderAddressRes = await fetch(`${baseUrl}/api/addresses`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        full_name: 'Buyer Delivery Address',
        line1: '123 Buyer Lane',
        city: 'Delhi',
        state: 'DL',
        pincode: '110001'
      })
    });
    const orderAddressData = await orderAddressRes.json();
    const orderAddressId = orderAddressData.data.id;

    // Test POST order with empty cart (should fail with 422)
    const emptyCartOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ address_id: orderAddressId })
    });
    console.log('Empty Cart Order Status:', emptyCartOrderRes.status);
    if (emptyCartOrderRes.status !== 422) {
      throw new Error(`Expected 422 for empty cart order, got ${emptyCartOrderRes.status}`);
    }

    // Add item to cart
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: newProductId, quantity: 2 })
    });

    // Test valid order placement
    const orderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ address_id: orderAddressId })
    });
    console.log('Order Placement Status:', orderRes.status);
    const orderData = await orderRes.json();
    if (orderRes.status !== 200 || !orderData.success) {
      throw new Error(`Order placement failed: ${JSON.stringify(orderData)}`);
    }
    const createdOrderId = orderData.data.order_id;
    if (!orderData.data.order_ref || !orderData.data.razorpay_order_id || orderData.data.status !== 'Awaiting Payment' || orderData.data.subtotal_paise !== 9600 || orderData.data.shipping_paise !== 12000 || orderData.data.total_paise !== 21600) {
      throw new Error(`Order details mismatch: ${JSON.stringify(orderData)}`);
    }

    // Verify cart is empty now
    const checkEmptyCartRes = await fetch(`${baseUrl}/api/cart`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const checkEmptyCartData = await checkEmptyCartRes.json();
    if (checkEmptyCartData.data.items.length !== 0) {
      throw new Error(`Expected cart to be empty after order, got ${checkEmptyCartData.data.items.length} items`);
    }

    // Test missing address_id (400)
    const missingAddressRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({})
    });
    console.log('Missing address_id Status:', missingAddressRes.status);
    if (missingAddressRes.status !== 400) {
      throw new Error(`Expected 400 for missing address_id, got ${missingAddressRes.status}`);
    }

    // Test nonexistent address_id (404)
    const nonexistentAddressRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ address_id: 999999 })
    });
    console.log('Nonexistent address_id Status:', nonexistentAddressRes.status);
    if (nonexistentAddressRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent address_id, got ${nonexistentAddressRes.status}`);
    }

    console.log('✓ Task 28 Passed: POST /api/orders');

    // --- TASK 29 TESTS: GET /api/orders ---
    console.log('--- Testing TASK 29: GET /api/orders ---');
    // Test unauthenticated GET
    const unauthOrdersRes = await fetch(`${baseUrl}/api/orders`);
    console.log('Unauth Orders Status:', unauthOrdersRes.status);
    if (unauthOrdersRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated orders fetch, got ${unauthOrdersRes.status}`);
    }

    // Fetch orders authenticated
    const ordersRes = await fetch(`${baseUrl}/api/orders`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Orders Status:', ordersRes.status);
    const ordersData = await ordersRes.json();
    if (ordersRes.status !== 200 || !ordersData.success || ordersData.data.orders.length !== 1) {
      throw new Error(`Orders fetch failed: ${JSON.stringify(ordersData)}`);
    }
    const orderItem = ordersData.data.orders[0];
    if (orderItem.id !== createdOrderId || orderItem.status !== 'Awaiting Payment' || orderItem.item_count !== 2 || orderItem.item_preview !== 'Speckled Moon Bowl') {
      throw new Error(`Order item mismatch: ${JSON.stringify(orderItem)}`);
    }

    // Test filter status=active (should return 1 order)
    const activeOrdersRes = await fetch(`${baseUrl}/api/orders?status=active`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const activeOrdersData = await activeOrdersRes.json();
    if (activeOrdersData.data.orders.length !== 1) {
      throw new Error(`Expected 1 active order, got ${activeOrdersData.data.orders.length}`);
    }

    // Test filter status=Delivered (should return 0 orders)
    const deliveredOrdersRes = await fetch(`${baseUrl}/api/orders?status=Delivered`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const deliveredOrdersData = await deliveredOrdersRes.json();
    if (deliveredOrdersData.data.orders.length !== 0) {
      throw new Error(`Expected 0 delivered orders, got ${deliveredOrdersData.data.orders.length}`);
    }

    console.log('✓ Task 29 Passed: GET /api/orders');

    // --- TASK 30 TESTS: GET /api/orders/:id ---
    console.log('--- Testing TASK 30: GET /api/orders/:id ---');
    // Test unauthenticated GET
    const unauthOrderDetailRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`);
    console.log('Unauth Order Detail Status:', unauthOrderDetailRes.status);
    if (unauthOrderDetailRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated order detail, got ${unauthOrderDetailRes.status}`);
    }

    // Fetch order details authenticated
    const orderDetailRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Order Detail Status:', orderDetailRes.status);
    const orderDetailData = await orderDetailRes.json();
    if (orderDetailRes.status !== 200 || !orderDetailData.success) {
      throw new Error(`Order detail fetch failed: ${JSON.stringify(orderDetailData)}`);
    }
    const details = orderDetailData.data;
    if (details.id !== createdOrderId || details.order_ref !== orderData.data.order_ref || details.status !== 'Awaiting Payment' || details.items.length !== 1 || details.ship_to.full_name !== 'Buyer Delivery Address') {
      throw new Error(`Order detail data mismatch: ${JSON.stringify(details)}`);
    }

    // Test GET order detail not owner (using sellerToken)
    const notOwnerOrderDetailRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    console.log('Not Owner Order Detail Status:', notOwnerOrderDetailRes.status);
    if (notOwnerOrderDetailRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner order detail, got ${notOwnerOrderDetailRes.status}`);
    }

    // Test GET nonexistent order detail
    const nonexistentOrderDetailRes = await fetch(`${baseUrl}/api/orders/999999`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Nonexistent Order Detail Status:', nonexistentOrderDetailRes.status);
    if (nonexistentOrderDetailRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent order detail, got ${nonexistentOrderDetailRes.status}`);
    }

    console.log('✓ Task 30 Passed: GET /api/orders/:id');

    // --- TASK 31 TESTS: POST /api/orders/:id/cancel ---
    console.log('--- Testing TASK 31: POST /api/orders/:id/cancel ---');
    // Test unauthenticated cancel
    const unauthCancelRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Changed my mind' })
    });
    console.log('Unauth Cancel Status:', unauthCancelRes.status);
    if (unauthCancelRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated cancel, got ${unauthCancelRes.status}`);
    }

    // Test missing reason
    const missingReasonCancelRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({})
    });
    console.log('Missing Reason Cancel Status:', missingReasonCancelRes.status);
    if (missingReasonCancelRes.status !== 400) {
      throw new Error(`Expected 400 for missing reason, got ${missingReasonCancelRes.status}`);
    }

    // Test not owner cancel (using sellerToken)
    const notOwnerCancelRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${sellerToken}`
      },
      body: JSON.stringify({ reason: 'Changed my mind' })
    });
    console.log('Not Owner Cancel Status:', notOwnerCancelRes.status);
    if (notOwnerCancelRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner cancel, got ${notOwnerCancelRes.status}`);
    }

    // Test valid cancel
    const initialStock = db.prepare("SELECT stock_qty FROM products WHERE id = ?").get(newProductId).stock_qty;
    const cancelRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ reason: 'Found a better price' })
    });
    console.log('Cancel Status:', cancelRes.status);
    const cancelData = await cancelRes.json();
    if (cancelRes.status !== 200 || !cancelData.success || cancelData.data.status !== 'Cancelled') {
      throw new Error(`Valid cancel failed: ${JSON.stringify(cancelData)}`);
    }

    // Verify stock was restored (+2 quantity from the order)
    const finalStock = db.prepare("SELECT stock_qty FROM products WHERE id = ?").get(newProductId).stock_qty;
    if (finalStock !== initialStock + 2) {
      throw new Error(`Expected stock to be restored to ${initialStock + 2}, got ${finalStock}`);
    }

    // Test cancel already cancelled order (should fail with 422)
    const recancelRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/cancel`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ reason: 'Recancel' })
    });
    console.log('Recancel Status:', recancelRes.status);
    if (recancelRes.status !== 422) {
      throw new Error(`Expected 422 for recancel, got ${recancelRes.status}`);
    }

    console.log('✓ Task 31 Passed: POST /api/orders/:id/cancel');

    // --- TASK 32 TESTS: GET /api/orders/:id/receipt ---
    console.log('--- Testing TASK 32: GET /api/orders/:id/receipt ---');
    // Test unauthenticated GET
    const unauthReceiptRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/receipt`);
    console.log('Unauth Receipt Status:', unauthReceiptRes.status);
    if (unauthReceiptRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated receipt, got ${unauthReceiptRes.status}`);
    }

    // Fetch receipt details authenticated
    const receiptRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/receipt`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Receipt Status:', receiptRes.status);
    const receiptData = await receiptRes.json();
    if (receiptRes.status !== 200 || !receiptData.success) {
      throw new Error(`Receipt fetch failed: ${JSON.stringify(receiptData)}`);
    }
    const receipt = receiptData.data;
    if (receipt.order_ref !== orderData.data.order_ref || receipt.billed_to.full_name !== 'Buyer Delivery Address' || receipt.shipped_to.full_name !== 'Buyer Delivery Address' || receipt.items.length !== 1 || receipt.seller_name !== 'Stoneware Studio') {
      throw new Error(`Receipt details mismatch: ${JSON.stringify(receipt)}`);
    }

    // Test GET receipt not owner (using sellerToken)
    const notOwnerReceiptRes = await fetch(`${baseUrl}/api/orders/${createdOrderId}/receipt`, {
      headers: { 'Authorization': `Bearer ${sellerToken}` }
    });
    console.log('Not Owner Receipt Status:', notOwnerReceiptRes.status);
    if (notOwnerReceiptRes.status !== 403) {
      throw new Error(`Expected 403 for non-owner receipt, got ${notOwnerReceiptRes.status}`);
    }

    // Test GET nonexistent receipt
    const nonexistentReceiptRes = await fetch(`${baseUrl}/api/orders/999999/receipt`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Nonexistent Receipt Status:', nonexistentReceiptRes.status);
    if (nonexistentReceiptRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent receipt, got ${nonexistentReceiptRes.status}`);
    }

    console.log('✓ Task 32 Passed: GET /api/orders/:id/receipt');

    // --- TASK 33 TESTS: POST /api/payments/initiate ---
    console.log('--- Testing TASK 33: POST /api/payments/initiate ---');
    // Create a new order for payment testing since the previous one is cancelled
    await fetch(`${baseUrl}/api/cart/items`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ product_id: newProductId, quantity: 1 })
    });
    const newOrderRes = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ address_id: orderAddressId })
    });
    const newOrderData = await newOrderRes.json();
    const payOrderId = newOrderData.data.order_id;

    // Test unauthenticated initiate
    const unauthInitRes = await fetch(`${baseUrl}/api/payments/initiate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ order_id: payOrderId })
    });
    console.log('Unauth Initiate Status:', unauthInitRes.status);
    if (unauthInitRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated initiate, got ${unauthInitRes.status}`);
    }

    // Test valid initiate
    const initRes = await fetch(`${baseUrl}/api/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ order_id: payOrderId })
    });
    console.log('Initiate Status:', initRes.status);
    const initData = await initRes.json();
    if (initRes.status !== 200 || !initData.success) {
      throw new Error(`Initiate payment failed: ${JSON.stringify(initData)}`);
    }
    if (!initData.data.razorpay_order_id || initData.data.amount_paise !== 16800 || initData.data.currency !== 'INR' || initData.data.prefill.name !== 'Test Buyer') {
      throw new Error(`Initiate data mismatch: ${JSON.stringify(initData)}`);
    }

    // Test initiate on cancelled order (should fail with 422)
    const cancelledInitRes = await fetch(`${baseUrl}/api/payments/initiate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({ order_id: createdOrderId })
    });
    console.log('Cancelled Initiate Status:', cancelledInitRes.status);
    if (cancelledInitRes.status !== 422) {
      throw new Error(`Expected 422 for cancelled order initiate, got ${cancelledInitRes.status}`);
    }

    console.log('✓ Task 33 Passed: POST /api/payments/initiate');

    // --- TASK 34 TESTS: POST /api/payments/verify ---
    console.log('--- Testing TASK 34: POST /api/payments/verify ---');
    // Test unauthenticated verify
    const unauthVerifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        order_id: payOrderId,
        razorpay_payment_id: 'pay_123456',
        razorpay_order_id: initData.data.razorpay_order_id,
        razorpay_signature: 'mock_signature'
      })
    });
    console.log('Unauth Verify Status:', unauthVerifyRes.status);
    if (unauthVerifyRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated verify, got ${unauthVerifyRes.status}`);
    }

    // Test invalid signature verify (should fail with 402)
    const invalidSigVerifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        order_id: payOrderId,
        razorpay_payment_id: 'pay_123456',
        razorpay_order_id: initData.data.razorpay_order_id,
        razorpay_signature: 'wrong_signature'
      })
    });
    console.log('Invalid Signature Verify Status:', invalidSigVerifyRes.status);
    if (invalidSigVerifyRes.status !== 402) {
      throw new Error(`Expected 402 for invalid signature, got ${invalidSigVerifyRes.status}`);
    }

    // Test valid verify with mock_signature
    const initialVerifyStock = db.prepare("SELECT stock_qty FROM products WHERE id = ?").get(newProductId).stock_qty;
    const verifyRes = await fetch(`${baseUrl}/api/payments/verify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${buyerToken}`
      },
      body: JSON.stringify({
        order_id: payOrderId,
        razorpay_payment_id: 'pay_123456',
        razorpay_order_id: initData.data.razorpay_order_id,
        razorpay_signature: 'mock_signature'
      })
    });
    console.log('Verify Status:', verifyRes.status);
    const verifyData = await verifyRes.json();
    if (verifyRes.status !== 200 || !verifyData.success || verifyData.data.status !== 'Processing') {
      throw new Error(`Valid verify failed: ${JSON.stringify(verifyData)}`);
    }

    // Verify stock was decremented (-1 quantity from the order)
    const finalVerifyStock = db.prepare("SELECT stock_qty FROM products WHERE id = ?").get(newProductId).stock_qty;
    if (finalVerifyStock !== initialVerifyStock - 1) {
      throw new Error(`Expected stock to be decremented to ${initialVerifyStock - 1}, got ${finalVerifyStock}`);
    }

    console.log('✓ Task 34 Passed: POST /api/payments/verify');

    // --- TASK 35 TESTS: GET /api/payments/history ---
    console.log('--- Testing TASK 35: GET /api/payments/history ---');
    // Test unauthenticated GET
    const unauthHistoryRes = await fetch(`${baseUrl}/api/payments/history`);
    console.log('Unauth History Status:', unauthHistoryRes.status);
    if (unauthHistoryRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated history fetch, got ${unauthHistoryRes.status}`);
    }

    // Fetch history authenticated
    const historyRes = await fetch(`${baseUrl}/api/payments/history`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('History Status:', historyRes.status);
    const historyData = await historyRes.json();
    if (historyRes.status !== 200 || !historyData.success) {
      throw new Error(`History fetch failed: ${JSON.stringify(historyData)}`);
    }
    const history = historyData.data;
    if (history.total_spent_paise !== 0 || history.completed_order_count !== 0 || history.pending_shipment_count !== 1 || history.payments.length !== 2) {
      throw new Error(`History values mismatch before Delivery: ${JSON.stringify(history)}`);
    }

    // Directly set order status to 'Delivered' to test spent aggregation
    db.prepare("UPDATE orders SET status = 'Delivered' WHERE id = ?").run(payOrderId);

    // Fetch history again
    const finalHistoryRes = await fetch(`${baseUrl}/api/payments/history`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const finalHistoryData = await finalHistoryRes.json();
    const finalHistory = finalHistoryData.data;
    if (finalHistory.total_spent_paise !== 16800 || finalHistory.completed_order_count !== 1 || finalHistory.pending_shipment_count !== 0) {
      throw new Error(`History values mismatch after Delivery: ${JSON.stringify(finalHistory)}`);
    }

    console.log('✓ Task 35 Passed: GET /api/payments/history');

    // --- TASK 36 TESTS: GET /api/wishlist ---
    console.log('--- Testing TASK 36: GET /api/wishlist ---');
    // Test unauthenticated GET
    const unauthWishlistRes = await fetch(`${baseUrl}/api/wishlist`);
    console.log('Unauth Wishlist Status:', unauthWishlistRes.status);
    if (unauthWishlistRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated wishlist fetch, got ${unauthWishlistRes.status}`);
    }

    // Fetch wishlist authenticated
    const wishlistRes = await fetch(`${baseUrl}/api/wishlist`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    console.log('Wishlist Status:', wishlistRes.status);
    const wishlistData = await wishlistRes.json();
    if (wishlistRes.status !== 200 || !wishlistData.success || wishlistData.data.count !== 1) {
      throw new Error(`Wishlist fetch failed: ${JSON.stringify(wishlistData)}`);
    }
    const wishlistItem = wishlistData.data.items[0];
    if (wishlistItem.product_id !== newProductId || wishlistItem.name !== 'Speckled Moon Bowl' || wishlistItem.in_cart !== false) {
      throw new Error(`Wishlist item details mismatch: ${JSON.stringify(wishlistItem)}`);
    }

    // Add product to cart to test in_cart flag
    db.prepare(`INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, 1)`).run(buyerId, newProductId);
    const wishlistWithCartRes = await fetch(`${baseUrl}/api/wishlist`, {
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const wishlistWithCartData = await wishlistWithCartRes.json();
    if (wishlistWithCartData.data.items[0].in_cart !== true) {
      throw new Error(`Expected in_cart to be true in wishlist, got ${wishlistWithCartData.data.items[0].in_cart}`);
    }

    // Clean up cart item
    db.prepare(`DELETE FROM cart_items WHERE user_id = ? AND product_id = ?`).run(buyerId, newProductId);

    console.log('✓ Task 36 Passed: GET /api/wishlist');

    // --- TASK 37 TESTS: POST /api/wishlist/:productId ---
    console.log('--- Testing TASK 37: POST /api/wishlist/:productId ---');
    db.prepare('DELETE FROM wishlists WHERE user_id = ? AND product_id = ?').run(buyerId, newProductId);

    // 1. Unauthenticated POST
    const unauthPostRes = await fetch(`${baseUrl}/api/wishlist/${newProductId}`, {
      method: 'POST'
    });
    if (unauthPostRes.status !== 401) {
      throw new Error(`Expected 401 for unauthenticated wishlist POST, got ${unauthPostRes.status}`);
    }

    // 2. Non-existent product POST
    const nonexistentPostRes = await fetch(`${baseUrl}/api/wishlist/99999`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    if (nonexistentPostRes.status !== 404) {
      throw new Error(`Expected 404 for nonexistent product wishlist POST, got ${nonexistentPostRes.status}`);
    }

    // 3. Successful POST
    const postRes = await fetch(`${baseUrl}/api/wishlist/${newProductId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const postData = await postRes.json();
    if (postRes.status !== 200 || !postData.success || postData.data.wishlisted !== true) {
      throw new Error(`Wishlist POST failed: ${JSON.stringify(postData)}`);
    }

    // 4. Duplicate POST (idempotent check)
    const dupPostRes = await fetch(`${baseUrl}/api/wishlist/${newProductId}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${buyerToken}` }
    });
    const dupPostData = await dupPostRes.json();
    if (dupPostRes.status !== 200 || !dupPostData.success || dupPostData.data.wishlisted !== true) {
      throw new Error(`Wishlist duplicate POST failed (should be idempotent): ${JSON.stringify(dupPostData)}`);
    }

    console.log('✓ Task 37 Passed: POST /api/wishlist/:productId');
  } catch (err) {
    console.error('❌ Integration test failed:', err.message);
    console.error(err.stack);
    exitCode = 1;
  } finally {
    server.close(() => {
      console.log('Integration test server closed');
      process.exit(exitCode);
    });
  }
}

// Start tests
setTimeout(runTests, 200);
