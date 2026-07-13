const UserProfile = require("../models/UserProfile");

// Whitelisted simulated top-up amounts.  This is a demo billing flow —
// there is no real payment processor — so we only accept a small set of
// preset amounts instead of trusting an arbitrary number from the client.
const TOPUP_PRESETS = [10, 50, 100];

// Keep the history list short so the document doesn't grow unbounded.
const MAX_HISTORY = 20;

class UserProfileService {
  /**
   * There is no multi-user auth yet, so the whole app shares a single
   * profile document.  Create it with sane defaults on first access.
   */
  async getOrCreate() {
    let profile = await UserProfile.findOne();
    if (!profile) {
      profile = await UserProfile.create({});
    }
    return profile;
  }

  /**
   * Update the editable profile fields (name, email).
   * Runs full Mongoose validation so bad input never reaches the DB.
   */
  async updateProfile({ name, email } = {}) {
    const profile = await this.getOrCreate();
    if (typeof name !== "undefined") profile.name = String(name).trim();
    if (typeof email !== "undefined") profile.email = String(email).trim().toLowerCase();
    await profile.save(); // throws ValidationError on bad name/email
    return profile;
  }

  /**
   * Store the public URL of an uploaded avatar image.
   * File-type / size validation happens in the multer layer before
   * this is ever called (see routes/api/profile.js).
   */
  async setAvatar(avatarUrl) {
    const profile = await this.getOrCreate();
    profile.avatarUrl = avatarUrl;
    await profile.save();
    return profile;
  }

  /**
   * Simulated credit top-up.  Only accepts whitelisted preset amounts.
   */
  async addCredits(amount, note) {
    const numericAmount = Number(amount);
    if (!TOPUP_PRESETS.includes(numericAmount)) {
      throw new Error(`Invalid top-up amount. Choose one of: ${TOPUP_PRESETS.join(", ")}`);
    }

    const profile = await this.getOrCreate();
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
  async setPlan(plan) {
    const ALLOWED = ["free", "pro", "max"];
    if (!ALLOWED.includes(plan)) {
      throw new Error(`Invalid plan. Must be one of: ${ALLOWED.join(", ")}`);
    }

    const profile = await this.getOrCreate();
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
