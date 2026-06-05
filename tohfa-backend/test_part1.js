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
