import Shop from '../models/shop.js';

/**
 * @route POST /api/requests/add-shop
 * @desc Adds a new shop registration to the database.
 * The requester ID logic will be added when user authentication is required.
 */
export const addShop = async (req, res) => {
  try {
    const { shopName, shopDescription, location } = req.body;

    if (!shopName || !location || typeof location.latitude !== 'number' || typeof location.longitude !== 'number') {
      return res.status(400).json({ success: false, message: "Shop name and valid location coordinates are required." });
    }

    const newShop = await Shop.create({
      shopName,
      shopDescription,
      location,
      // Note: If you implement user IDs, remember to add 'owner: req.user._id' here.
    });

    return res.status(201).json({ success: true, message: "Shop added successfully.", shop: newShop });
  } catch (error) {
    console.error('Error adding shop:', error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

/**
 * @route GET /api/requests/get-shops
 * @desc Fetches all registered shops (or nearby shops if location is added).
 */
export const getShops = async (req, res) => {
  // In a future update, you should add logic here to filter by proximity based on user location.
  try {
    const shops = await Shop.find({});
    return res.status(200).json({ success: true, shops });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
