import { Router } from 'express'
import { createLocation, deleteLocation, getLocations, updateLocation } from '../controllers/location.controller'

const router = Router()

router.post('/create-location', createLocation)
router.put('/update-location/:id', updateLocation)
router.get('/get-location', getLocations)
router.delete('/delete-location/:id', deleteLocation)

export default router