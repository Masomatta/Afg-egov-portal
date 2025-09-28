import express from "express"
import authroutes from "./auth.js"

const router = express.Router()

router.use("/auth", authroutes)

export default router;