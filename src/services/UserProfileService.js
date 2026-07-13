const UserProfile = require("../models/UserProfile");

// Whitelisted simulated top-up amounts.  This is a demo billing flow —
// there is no real payment processor — so we only accept a small set of
// preset amounts instead of trusting an arbitrary number from the client.
const TOPUP_PRESETS = [10, 50, 100];

// Keep the history list short so the document doesn't grow unbounded.
const MAX_HISTORY = 20;

class UserProfileService {
  /**
   * Load or create the profile that belongs to one authenticated account.
   */
  async getOrCreate(ownerEmail) {
    if (!ownerEmail) throw new Error("ownerEmail is required");
    const normalizedOwner = String(ownerEmail).trim().toLowerCase();
    let profile = await UserProfile.findOne({ ownerEmail: normalizedOwner });
    if (!profile) {
      try {
        profile = await UserProfile.create({ ownerEmail: normalizedOwner, email: normalizedOwner });
      } catch (err) {
        if (err && err.code === 11000) {
          profile = await UserProfile.findOne({ ownerEmail: normalizedOwner });
        } else {
          throw err;
        }
      }
    }
    return profile;
  }

  /**
   * Update editable profile fields for one account.
   * Runs full Mongoose validation so bad input never reaches the DB.
   */
  async updateProfile(ownerEmail, { name } = {}) {
    const profile = await this.getOrCreate(ownerEmail);
    if (typeof name !== "undefined") profile.name = String(name).trim();
    await profile.save(); // throws ValidationError on bad name/email
    return profile;
  }

  /**
   * Store the public URL of an uploaded avatar image.
   * File-type / size validation happens in the multer layer before
   * this is ever called (see routes/api/profile.js).
   */
  async setAvatar(ownerEmail, avatarUrl) {
    const profile = await this.getOrCreate(ownerEmail);
    profile.avatarUrl = avatarUrl;
    await profile.save();
    return profile;
  }

  /**
   * Simulated credit top-up.  Only accepts whitelisted preset amounts.
   */
  async addCredits(ownerEmail, amount, note) {
    const numericAmount = Number(amount);
    if (!TOPUP_PRESETS.includes(numericAmount)) {
      throw new Error(`Invalid top-up amount. Choose one of: ${TOPUP_PRESETS.join(", ")}`);
    }

    const profile = await this.getOrCreate(ownerEmail);
    profile.credits += numericAmount;
    profile.history.unshift({
      type: "topup",
      amount: numericAmount,
      note: note || `Added ${numericAmount} credits (simulated purchase)`,
    });
    profile.history = profile.history.slice(0, MAX_HISTORY);
    await profile.save();
    return profile;
  }

  /**
   * Simulated plan change (Free / Pro / Max). No real payment involved.
   */
  async setPlan(ownerEmail, plan) {
    const ALLOWED = ["free", "pro", "max"];
    if (!ALLOWED.includes(plan)) {
      throw new Error(`Invalid plan. Must be one of: ${ALLOWED.join(", ")}`);
    }

    const profile = await this.getOrCreate(ownerEmail);
    const previousPlan = profile.plan;
    profile.plan = plan;
    profile.history.unshift({
      type: "plan_change",
      amount: 0,
      note: `Changed plan: ${previousPlan} → ${plan} (simulated)`,
    });
    profile.history = profile.history.slice(0, MAX_HISTORY);
    await profile.save();
    return profile;
  }
}

module.exports = new UserProfileService();
module.exports.TOPUP_PRESETS = TOPUP_PRESETS;
