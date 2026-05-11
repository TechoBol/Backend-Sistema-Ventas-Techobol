import jwt from 'jsonwebtoken'
import { Request, Response, NextFunction } from 'express'
import { config } from 'dotenv'
config()

export const verifyToken = (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const token = req.headers['x-access-token']
    if (!token) {
      return res.status(403).json({ message: 'No token provided' })
    }

    const userEmailDecoded = jwt.verify(
      token as string,
      process.env.JWTSECRET as string
    )

    if (!userEmailDecoded) {
      return res.status(401).json({ message: 'Unauthorized' })
    }
    next()
    return null
  } catch {
    return res.status(401).json({ message: 'Unauthorized' })
  }
}
