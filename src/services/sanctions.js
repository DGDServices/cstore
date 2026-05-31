const SanctionsScreening = require('../models/SanctionsScreening');
const logger = require('../utils/logger');

/**
 * Sanctions Screening Service
 * Screens users and transactions against OFAC, UN, EU sanctions lists
 */
class SanctionsService {
  constructor() {
    this.enabled = process.env.AML_ENABLED === 'true';
    this.apiKey = process.env.SANCTIONS_API_KEY;
    
    // Simplified sanctions lists for demonstration
    this.sanctionedEntities = {
      OFAC: ['Iran', 'North Korea', 'Syria', 'Cuba', 'Venezuela', 'Russia'],
      UN: ['North Korea', 'Iran', 'Somalia', 'Libya'],
      EU: ['Russia', 'Belarus', 'Myanmar'],
      countries: ['IR', 'KP', 'SY', 'CU']
    };
  }

  /**
   * Screen a user against sanctions lists
   */
  async screenUser(userId, userData) {
    if (!this.enabled) {
      return {
        result: 'clear',
        action: 'allow'
      };
    }

    try {
      const matches = [];
      
      // Screen against country sanctions
      if (userData.country) {
        const countryMatch = await this.checkCountrySanctions(userData.country);
        if (countryMatch) {
          matches.push(countryMatch);
        }
      }

      // Screen name against sanctions lists (simplified)
      if (userData.name) {
        const nameMatch = await this.checkNameSanctions(userData.name);
        if (nameMatch) {
          matches.push(nameMatch);
        }
      }

      // Determine result and action
      let result = 'clear';
      let action = 'allow';

      if (matches.length > 0) {
        // Check match scores
        const highConfidenceMatch = matches.some(m => m.matchScore >= 90);
        
        if (highConfidenceMatch) {
          result = 'confirmed_match';
          action = 'block';
        } else {
          result = 'potential_match';
          action = 'manual_review';
        }
      }

      // Create screening record
      const screening = new SanctionsScreening({
        user: userId,
        result,
        lists: matches,
        action
      });

      await screening.save();

      logger.info(`Sanctions screening completed for user ${userId}: ${result}`);

      return {
        screeningId: screening._id,
        result,
        action,
        matches
      };
    } catch (error) {
      logger.error(`Error screening user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Check country against sanctions lists
   */
  async checkCountrySanctions(countryCode) {
    try {
      const matches = [];

      // Check OFAC list
      if (this.sanctionedEntities.countries.includes(countryCode)) {
        return {
          name: 'Country Sanctions',
          source: 'OFAC',
          matchScore: 100,
          matchDetails: {
            countryCode,
            reason: 'Country is under comprehensive sanctions'
          }
        };
      }

      return null;
    } catch (error) {
      logger.error(`Error checking country sanctions: ${error.message}`);
      return null;
    }
  }

  /**
   * Check name against sanctions lists
   */
  async checkNameSanctions(name) {
    try {
      // In production, this would call actual sanctions screening API
      // For now, simplified logic
      
      const suspiciousNames = ['test sanctioned', 'blocked entity'];
      const normalizedName = name.toLowerCase();
      
      for (const sanctionedName of suspiciousNames) {
        if (normalizedName.includes(sanctionedName)) {
          return {
            name: 'Name Match',
            source: 'OFAC',
            matchScore: 85,
            matchDetails: {
              searchName: name,
              matchedName: sanctionedName
            }
          };
        }
      }

      return null;
    } catch (error) {
      logger.error(`Error checking name sanctions: ${error.message}`);
      return null;
    }
  }

  /**
   * Re-screen user (periodic screening)
   */
  async rescreenUser(userId) {
    try {
      const User = require('../models/User');
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }

      const userData = {
        name: user.name,
        country: user.country
      };

      const result = await this.screenUser(userId, userData);

      // Update next screening date (e.g., every 30 days)
      const screening = await SanctionsScreening.findById(result.screeningId);
      screening.nextScreeningDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
      await screening.save();

      return result;
    } catch (error) {
      logger.error(`Error rescreening user: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get screening history for a user
   */
  async getScreeningHistory(userId) {
    try {
      const screenings = await SanctionsScreening.find({ user: userId })
        .sort({ screeningDate: -1 })
        .limit(10);

      return screenings;
    } catch (error) {
      logger.error(`Error getting screening history: ${error.message}`);
      throw error;
    }
  }

  /**
   * Review a potential match
   */
  async reviewMatch(screeningId, reviewData) {
    try {
      const screening = await SanctionsScreening.findById(screeningId);
      
      if (!screening) {
        throw new Error('Screening not found');
      }

      screening.reviewedBy = reviewData.reviewedBy;
      screening.reviewNotes = reviewData.notes;
      screening.reviewedAt = new Date();
      screening.action = reviewData.action;

      if (reviewData.action === 'allow') {
        screening.result = 'clear';
      }

      await screening.save();

      logger.info(`Sanctions screening ${screeningId} reviewed: ${reviewData.action}`);

      return screening;
    } catch (error) {
      logger.error(`Error reviewing match: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get users requiring screening
   */
  async getUsersRequiringScreening() {
    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const screenings = await SanctionsScreening.find({
        $or: [
          { nextScreeningDate: { $lte: new Date() } },
          { screeningDate: { $lte: thirtyDaysAgo } }
        ]
      }).populate('user', 'name email');

      return screenings;
    } catch (error) {
      logger.error(`Error getting users requiring screening: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get pending reviews
   */
  async getPendingReviews() {
    try {
      const screenings = await SanctionsScreening.find({
        result: 'potential_match',
        action: 'manual_review',
        reviewedAt: { $exists: false }
      })
        .populate('user', 'name email')
        .sort({ screeningDate: -1 });

      return screenings;
    } catch (error) {
      logger.error(`Error getting pending reviews: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get sanctions statistics
   */
  async getStatistics(startDate, endDate) {
    try {
      const stats = await SanctionsScreening.aggregate([
        {
          $match: {
            screeningDate: {
              $gte: startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
              $lte: endDate || new Date()
            }
          }
        },
        {
          $group: {
            _id: {
              result: '$result',
              action: '$action'
            },
            count: { $sum: 1 }
          }
        }
      ]);

      return stats;
    } catch (error) {
      logger.error(`Error getting sanctions statistics: ${error.message}`);
      throw error;
    }
  }
}

// Export singleton instance
module.exports = new SanctionsService();
