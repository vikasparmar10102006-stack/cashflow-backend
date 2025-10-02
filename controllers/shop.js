import Shop from '../models/shop.js';

export const addShop = async (req, res) => {
  try {
    const { shopName, shopDescription, location } = req.body;

    if (!shopName || !location || !location.latitude || !location.longitude) {
      return res.status(400).json({ success: false, message: "Shop name and location are required." });
    }

    const newShop = await Shop.create({
      shopName,
      shopDescription,
      location,
    });

    return res.status(201).json({ success: true, message: "Shop added successfully.", shop: newShop });
  } catch (error) {
    console.error('Error adding shop:', error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};

export const getShops = async (req, res) => {
  try {
    const shops = await Shop.find({});
    return res.status(200).json({ success: true, shops });
  } catch (error) {
    console.error('Error fetching shops:', error);
    return res.status(500).json({ success: false, message: "Internal server error." });
  }
};
