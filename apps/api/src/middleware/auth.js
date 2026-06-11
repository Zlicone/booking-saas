const jwt = require('jsonwebtoken');
const { query } = require('../db');

// Middleware za zaštićene admin rute
const authenticateAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Niste prijavljeni. Molimo prijavite se.' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return res.status(401).json({ error: 'Sesija je istekla. Molimo prijavite se ponovo.' });
      }
      return res.status(401).json({ error: 'Nevažeći token.' });
    }
    
    // Provjeri da biznis još uvijek postoji i je aktivan
    const result = await query(
      'SELECT id, email, name, slug, is_active, subscription_status, trial_ends_at, is_demo FROM businesses WHERE id = $1',
      [decoded.businessId]
    );
    
    if (!result.rows[0]) {
      return res.status(401).json({ error: 'Račun ne postoji.' });
    }
    
    const business = result.rows[0];
    
    if (!business.is_active) {
      return res.status(403).json({ error: 'Vaš račun je deaktiviran.' });
    }
    
    // Provjeri pretplatu (osim za demo account)
    if (!business.is_demo) {
      const now = new Date();
      const isTrialExpired = 
        business.subscription_status === 'trial' && 
        new Date(business.trial_ends_at) < now;
      
      const isSubscriptionInactive = 
        business.subscription_status === 'canceled' ||
        business.subscription_status === 'past_due';
      
      if (isTrialExpired || isSubscriptionInactive) {
        return res.status(402).json({ 
          error: 'Vaša pretplata je istekla.',
          code: 'SUBSCRIPTION_REQUIRED'
        });
      }
    }
    
    req.business = business;
    next();
    
  } catch (err) {
    console.error('Auth middleware error:', err);
    res.status(500).json({ error: 'Greška na serveru.' });
  }
};

// Lagana verzija — samo provjeri token bez DB poziva (za manje kritične rute)
const authenticateAdminLight = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Niste prijavljeni.' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    req.business = { id: decoded.businessId, email: decoded.email };
    next();
    
  } catch (err) {
    return res.status(401).json({ error: 'Nevažeći token.' });
  }
};

module.exports = { authenticateAdmin, authenticateAdminLight };
