import nodemailer from 'nodemailer'
import { config } from 'dotenv'

config()

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.USER_EMAIL,
        pass: process.env.USER_EMAIL_PASSWORD
    }
})

export default transporter
