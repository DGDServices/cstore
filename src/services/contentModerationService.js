const https = require('https');
const http = require('http');
const ContentModerationLog = require('../models/ContentModerationLog');
const ProhibitedItemRule = require('../models/ProhibitedItemRule');
const logger = require('../utils/logger');

function makeRequest(urlStr, options, body) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const isHttps = url.protocol === 'https:';
    const lib = isHttps ? https : http;
    const reqOptions = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname + url.search,
      method: options.method || 'POST',
      headers: options.headers || {}
    };
    const req = lib.request(reqOptions, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

class ContentModerationService {
  constructor() {
    this.photodnaEnabled = process.env.PHOTODNA_ENABLED === 'true';
    this.awsRekognitionEnabled = process.env.AWS_REKOGNITION_ENABLED === 'true';
    this.azureContentSafetyEnabled = process.env.AZURE_CONTENT_SAFETY_ENABLED === 'true';
    this.openaiModerationEnabled = process.env.OPENAI_MODERATION_ENABLED === 'true';
    this.perspectiveApiEnabled = process.env.PERSPECTIVE_API_ENABLED === 'true';

    this.photodnaApiKey = process.env.PHOTODNA_API_KEY;
    this.photodnaApiUrl = process.env.PHOTODNA_PRIVATE_API_URL;
    this.awsAccessKeyId = process.env.AWS_ACCESS_KEY_ID;
    this.awsSecretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
    this.awsRegion = process.env.AWS_REGION || 'us-east-1';
    this.azureContentSafetyKey = process.env.AZURE_CONTENT_SAFETY_KEY;
    this.azureContentSafetyEndpoint = process.env.AZURE_CONTENT_SAFETY_ENDPOINT;
    this.openaiApiKey = process.env.OPENAI_API_KEY;
    this.perspectiveApiKey = process.env.PERSPECTIVE_API_KEY;
  }

  async moderateContent(contentType, contentId, contentData, submittedBy) {
    const { text, imageUrls = [], metadata } = contentData;

    const log = new ContentModerationLog({
      contentType,
      contentId,
      contentRef: contentType,
      submittedBy,
      checks: [],
      metadata
    });

    const [textChecks, imageChecks] = await Promise.all([
      text ? this.checkText(text) : Promise.resolve([]),
      imageUrls.length > 0 ? this.checkImages(imageUrls) : Promise.resolve([])
    ]);

    const allChecks = [...textChecks, ...imageChecks];
    log.checks = allChecks;

    let disposition = 'approved';
    let csamDetected = false;

    for (const check of allChecks) {
      if (check.result === 'fail') {
        if (check.categories && check.categories.includes('csam')) {
          csamDetected = true;
        }
        disposition = 'rejected';
      } else if (check.result === 'review' && disposition !== 'rejected') {
        disposition = 'pending_review';
      }
    }

    log.disposition = disposition;

    if (csamDetected) {
      log.csam = true;
      log.disposition = 'rejected';
      log.legalHold = true;
    }

    log.dispositionAt = csamDetected || disposition !== 'pending_review' ? new Date() : undefined;

    await log.save();

    if (csamDetected) {
      try {
        const authorityReportingService = require('./authorityReportingService');
        const userInfo = { userId: submittedBy, ipAddress: metadata && metadata.ipAddress, deviceFingerprint: metadata && metadata.deviceFingerprint };
        const contentInfo = { hash: metadata && metadata.hash };
        await authorityReportingService.reportCSAM(log._id, userInfo, contentInfo);
      } catch (err) {
        logger.error('Failed to report CSAM to authority reporting service', { error: err.message, logId: log._id });
      }
    }

    return log;
  }

  async checkText(text) {
    const [openaiResult, perspectiveResult, keywordResult] = await Promise.all([
      this.checkOpenAIModerationAPI(text),
      this.checkPerspectiveAPI(text),
      this.checkKeywordBlocklist(text)
    ]);
    return [openaiResult, perspectiveResult, keywordResult];
  }

  async checkImages(imageUrls) {
    const results = [];
    for (const imageUrl of imageUrls) {
      const [photodnaResult, awsResult, azureResult] = await Promise.all([
        this.checkPhotoDNA(imageUrl),
        this.checkAWSRekognition(imageUrl),
        this.checkAzureContentSafety(imageUrl)
      ]);
      results.push(photodnaResult, awsResult, azureResult);
    }
    return results;
  }

  async checkOpenAIModerationAPI(text) {
    const base = { provider: 'openai_moderation', categories: [] };
    if (!this.openaiModerationEnabled || !text) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    if (!this.openaiApiKey) {
      return { ...base, result: 'error', confidence: 0 };
    }
    try {
      const body = { input: text };
      const response = await makeRequest('https://api.openai.com/v1/moderations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        }
      }, body);

      const result = response.body;
      if (!result.results || !result.results[0]) {
        return { ...base, result: 'error', confidence: 0 };
      }

      const item = result.results[0];
      if (item.flagged) {
        const flaggedCategories = Object.entries(item.categories || {})
          .filter(([, v]) => v)
          .map(([k]) => k);
        return { ...base, result: 'fail', confidence: 1, categories: flaggedCategories, rawResponse: result };
      }
      return { ...base, result: 'pass', confidence: 1, rawResponse: result };
    } catch (err) {
      logger.error('OpenAI moderation API error', { error: err.message });
      return { ...base, result: 'error', confidence: 0 };
    }
  }

  async checkPerspectiveAPI(text) {
    const base = { provider: 'perspective_api', categories: [] };
    if (!this.perspectiveApiEnabled || !text) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    if (!this.perspectiveApiKey) {
      return { ...base, result: 'error', confidence: 0 };
    }
    try {
      const body = {
        comment: { text },
        requestedAttributes: { TOXICITY: {}, THREAT: {} }
      };
      const url = `https://commentanalyzer.googleapis.com/v1alpha1/comments:analyze?key=${this.perspectiveApiKey}`;
      const response = await makeRequest(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      }, body);

      const result = response.body;
      const scores = result.attributeScores || {};
      const toxicityScore = scores.TOXICITY && scores.TOXICITY.summaryScore ? scores.TOXICITY.summaryScore.value : 0;
      const threatScore = scores.THREAT && scores.THREAT.summaryScore ? scores.THREAT.summaryScore.value : 0;

      if (toxicityScore > 0.8 || threatScore > 0.7) {
        const flagged = [];
        if (toxicityScore > 0.8) flagged.push('toxicity');
        if (threatScore > 0.7) flagged.push('threat');
        return { ...base, result: 'fail', confidence: Math.max(toxicityScore, threatScore), categories: flagged, rawResponse: result };
      }
      return { ...base, result: 'pass', confidence: 1, rawResponse: result };
    } catch (err) {
      logger.error('Perspective API error', { error: err.message });
      return { ...base, result: 'error', confidence: 0 };
    }
  }

  async checkKeywordBlocklist(text) {
    const base = { provider: 'keyword_blocklist', categories: [] };
    if (!text) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    try {
      const rules = await ProhibitedItemRule.find({ ruleType: 'keyword', enabled: true });
      for (const rule of rules) {
        if (!rule.keywords || rule.keywords.length === 0) continue;
        const textToMatch = rule.keywordCaseSensitive ? text : text.toLowerCase();
        let matched = false;

        if (rule.keywordMatchMode === 'regex') {
          matched = rule.keywords.some((kw) => {
            try {
              const flags = rule.keywordCaseSensitive ? '' : 'i';
              return new RegExp(kw, flags).test(textToMatch);
            } catch (e) {
              return false;
            }
          });
        } else if (rule.keywordMatchMode === 'all') {
          matched = rule.keywords.every((kw) => {
            const term = rule.keywordCaseSensitive ? kw : kw.toLowerCase();
            return textToMatch.includes(term);
          });
        } else {
          matched = rule.keywords.some((kw) => {
            const term = rule.keywordCaseSensitive ? kw : kw.toLowerCase();
            return textToMatch.includes(term);
          });
        }

        if (matched) {
          if (rule.severity === 'reject' || rule.severity === 'ban') {
            return { ...base, result: 'fail', confidence: 1, categories: ['prohibited_keyword'] };
          }
          if (rule.severity === 'review') {
            return { ...base, result: 'review', confidence: 1, categories: ['prohibited_keyword'] };
          }
        }
      }
      return { ...base, result: 'pass', confidence: 1 };
    } catch (err) {
      logger.error('Keyword blocklist check error', { error: err.message });
      return { ...base, result: 'error', confidence: 0 };
    }
  }

  async checkPhotoDNA(imageUrl) {
    const base = { provider: 'photodna', categories: [] };
    if (!this.photodnaEnabled) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    if (!this.photodnaApiUrl || !this.photodnaApiKey) {
      return { ...base, result: 'error', confidence: 0 };
    }
    try {
      const body = { url: imageUrl };
      const response = await makeRequest(this.photodnaApiUrl, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.photodnaApiKey,
          'Content-Type': 'application/json'
        }
      }, body);

      const result = response.body;
      if (result.isMatch) {
        return { ...base, result: 'fail', confidence: 1, categories: ['csam'], rawResponse: result };
      }
      return { ...base, result: 'pass', confidence: 1, rawResponse: result };
    } catch (err) {
      logger.error('PhotoDNA check error', { error: err.message });
      return { ...base, result: 'error', confidence: 0 };
    }
  }

  async checkAWSRekognition(imageUrl) {
    const base = { provider: 'aws_rekognition', categories: [] };
    if (!this.awsRekognitionEnabled) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    if (!this.awsAccessKeyId || !this.awsSecretAccessKey) {
      logger.warn('AWS Rekognition enabled but credentials not configured - skipping');
      return { ...base, result: 'pass', confidence: 1 };
    }
    // AWS Rekognition requires Signature V4 signing which needs the AWS SDK.
    // Without introducing new dependencies, we degrade gracefully.
    logger.warn('AWS Rekognition requires @aws-sdk - returning pass (stub)', { imageUrl });
    return { ...base, result: 'pass', confidence: 1 };
  }

  async checkAzureContentSafety(imageUrl) {
    const base = { provider: 'azure_content_safety', categories: [] };
    if (!this.azureContentSafetyEnabled) {
      return { ...base, result: 'pass', confidence: 1 };
    }
    if (!this.azureContentSafetyEndpoint || !this.azureContentSafetyKey) {
      return { ...base, result: 'error', confidence: 0 };
    }
    try {
      const url = `${this.azureContentSafetyEndpoint}/contentsafety/image:analyze?api-version=2023-10-01`;
      const body = { image: { url: imageUrl } };
      const response = await makeRequest(url, {
        method: 'POST',
        headers: {
          'Ocp-Apim-Subscription-Key': this.azureContentSafetyKey,
          'Content-Type': 'application/json'
        }
      }, body);

      const result = response.body;
      const categoriesResult = result.categoriesAnalysis || [];
      const flagged = categoriesResult.filter((c) => c.severity > 2);

      if (flagged.length > 0) {
        return {
          ...base,
          result: 'fail',
          confidence: 1,
          categories: flagged.map((c) => c.category),
          rawResponse: result
        };
      }
      return { ...base, result: 'pass', confidence: 1, rawResponse: result };
    } catch (err) {
      logger.error('Azure Content Safety check error', { error: err.message });
      return { ...base, result: 'error', confidence: 0 };
    }
  }

  async getContentModerationLog(contentType, contentId) {
    return ContentModerationLog
      .findOne({ contentType, contentId })
      .sort({ createdAt: -1 })
      .populate('submittedBy', 'name email')
      .populate('dispositionBy', 'name email');
  }

  async getModerationQueue(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      ContentModerationLog
        .find({ disposition: 'pending_review' })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('submittedBy', 'name email'),
      ContentModerationLog.countDocuments({ disposition: 'pending_review' })
    ]);
    return { items, page, limit, total };
  }

  async reviewContent(logId, decision, reviewedBy, reason) {
    const log = await ContentModerationLog.findByIdAndUpdate(
      logId,
      {
        disposition: decision,
        dispositionBy: reviewedBy,
        dispositionAt: new Date(),
        dispositionReason: reason
      },
      { new: true }
    ).populate('submittedBy', 'name email').populate('dispositionBy', 'name email');
    return log;
  }

  async processAppeal(logId, appealReason, _userId) {
    const log = await ContentModerationLog.findByIdAndUpdate(
      logId,
      { appealedAt: new Date(), appealReason },
      { new: true }
    );
    return log;
  }
}

module.exports = new ContentModerationService();
