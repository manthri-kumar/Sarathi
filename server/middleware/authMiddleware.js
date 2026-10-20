const jwt = require("jsonwebtoken");
const User = require("../models/User");

const protect = (req, res, next) => {
  let token;

  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ["HS256"] });
      if (!decoded || typeof decoded.id !== "string" || decoded.purpose) {
        return res.status(401).json({ message: "Not authorized" });
      }

      req.user = decoded;   // contains id
      // Tokens issued after the session-version rollout are checked against
      // the account record. Legacy id-only tokens remain compatible until the
      // account is reset; a reset increments the version and invalidates all
      // versioned sessions without requiring a mass logout.
      if (decoded.sv === undefined) return next();
      return User.findById(decoded.id).select("sessionVersion").then((user) => {
        if (!user || (user.sessionVersion || 0) !== decoded.sv) {
          return res.status(401).json({ message: "Session expired" });
        }
        return next();
      }).catch(() => res.status(401).json({ message: "Not authorized" }));

    } catch (error) {
      return res.status(401).json({ message: "Not authorized" });
    }
  }

  if (!token) {
    return res.status(401).json({ message: "No token" });
  }
};

module.exports = protect;
