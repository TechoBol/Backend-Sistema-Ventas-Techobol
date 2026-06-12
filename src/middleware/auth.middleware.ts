import jwt, { JwtPayload } from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { config } from 'dotenv'
config()

export interface AuthUser {
  id: number;
  email: string;
  role: string;
  level: number;
  locationId: number | null;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction) => {
  try {
    const token = req.headers['x-access-token']
    if (!token) {
      return res.status(403).json({ message: 'No token provided' })
    }

    const decoded = jwt.verify(token as string, process.env.JWTSECRET as string) as JwtPayload

    if (!decoded) {
      return res.status(401).json({ message: 'Unauthorized' })
    }

    req.user = {
      id: decoded.id,
      email: decoded.email,
      role: decoded.role,
      level: decoded.level,
      locationId: decoded.locationId,
    }

    next()
    return null
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}