require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
app.use(express.json({ limit: '100kb' }));

const householdSchema = new mongoose.Schema({
  householdId: { type: String, required: true, trim: true, uppercase: true, unique: true },
  headName: { type: String, required: true, trim: true, maxlength: 100 },
  village: { type: String, required: true, trim: true, maxlength: 80 },
  householdSize: { type: Number, required: true, min: 1, validate: Number.isInteger },
  phone: { type: String, required: true, trim: true, maxlength: 30 }
}, { timestamps: true });

const sourceSchema = new mongoose.Schema({
  sourceId: { type: String, required: true, trim: true, uppercase: true, unique: true },
  name: { type: String, required: true, trim: true, maxlength: 100 },
  village: { type: String, required: true, trim: true, maxlength: 80 },
  sourceType: { type: String, required: true, trim: true, maxlength: 60 },
  capacityLitres: { type: Number, required: true, min: 1 },
  availableLitres: { type: Number, required: true, min: 0 },
  operational: { type: Boolean, default: true }
}, { timestamps: true });
sourceSchema.path('availableLitres').validate(function (value) { return value <= this.capacityLitres; }, 'Available water cannot exceed capacity.');

const requestSchema = new mongoose.Schema({
  requestId: { type: String, required: true, trim: true, uppercase: true, unique: true },
  householdId: { type: String, required: true, trim: true, uppercase: true },
  village: { type: String, required: true, trim: true, maxlength: 80 },
  litresRequested: { type: Number, required: true, min: 1 },
  requestType: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: ['Pending', 'In Progress', 'Completed'], default: 'Pending' },
  requestedAt: { type: Date, default: Date.now }
}, { timestamps: true });

const scheduleSchema = new mongoose.Schema({
  scheduleId: { type: String, required: true, trim: true, uppercase: true, unique: true },
  village: { type: String, required: true, trim: true, maxlength: 80 },
  serviceDate: { type: Date, required: true },
  vehicle: { type: String, required: true, trim: true, maxlength: 50 },
  teamLead: { type: String, required: true, trim: true, maxlength: 100 },
  serviceType: { type: String, required: true, trim: true, maxlength: 80 },
  status: { type: String, enum: ['Scheduled', 'In Progress', 'Completed'], default: 'Scheduled' }
}, { timestamps: true });

const models = {
  households: mongoose.model('Household', householdSchema),
  waterSources: mongoose.model('WaterSource', sourceSchema),
  waterRequests: mongoose.model('WaterRequest', requestSchema),
  deliverySchedules: mongoose.model('DeliverySchedule', scheduleSchema)
};
const labels = { households: 'Household', waterSources: 'Water source', waterRequests: 'Water request', deliverySchedules: 'Delivery schedule' };
const asyncRoute = fn => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const validId = id => mongoose.isValidObjectId(id);
const safeSearch = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

app.get('/api/health', (req, res) => res.json({ ok: mongoose.connection.readyState === 1 }));
app.get('/api/summary', asyncRoute(async (req, res) => {
  const [households, sources, requests, schedules, openRequests, lowSources, upcoming] = await Promise.all([
    models.households.countDocuments(), models.waterSources.countDocuments(), models.waterRequests.countDocuments(), models.deliverySchedules.countDocuments(),
    models.waterRequests.countDocuments({ status: { $ne: 'Completed' } }),
    models.waterSources.countDocuments({ operational: true, $expr: { $lt: [{ $divide: ['$availableLitres', '$capacityLitres'] }, 0.25] } }),
    models.deliverySchedules.countDocuments({ status: 'Scheduled', serviceDate: { $gte: new Date() } })
  ]);
  const statusCounts = await models.waterRequests.aggregate([{ $group: { _id: '$status', count: { $sum: 1 } } }, { $sort: { _id: 1 } }]);
  res.json({ households, sources, requests, schedules, openRequests, lowSources, upcoming, statusCounts });
}));

app.get('/api/:collection', asyncRoute(async (req, res) => {
  const Model = models[req.params.collection];
  if (!Model) return res.status(404).json({ error: 'Collection not found.' });
  const { search = '', status = '', village = '' } = req.query;
  const filter = {};
  if (search) {
    const regex = new RegExp(safeSearch(String(search).slice(0, 80)), 'i');
    const fields = { households: ['householdId', 'headName', 'village', 'phone'], waterSources: ['sourceId', 'name', 'village', 'sourceType'], waterRequests: ['requestId', 'householdId', 'village', 'requestType'], deliverySchedules: ['scheduleId', 'village', 'vehicle', 'teamLead', 'serviceType'] }[req.params.collection];
    filter.$or = fields.map(field => ({ [field]: regex }));
  }
  if (status) filter.status = status;
  if (village) filter.village = village;
  const sort = req.params.collection === 'deliverySchedules' ? { serviceDate: 1 } : { updatedAt: -1 };
  res.json(await Model.find(filter).sort(sort).limit(500).lean());
}));
app.get('/api/:collection/:id', asyncRoute(async (req, res) => {
  const Model = models[req.params.collection];
  if (!Model) return res.status(404).json({ error: 'Collection not found.' });
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' });
  const row = await Model.findById(req.params.id).lean();
  if (!row) return res.status(404).json({ error: `${labels[req.params.collection]} not found.` });
  res.json(row);
}));
app.post('/api/:collection', asyncRoute(async (req, res) => {
  const Model = models[req.params.collection];
  if (!Model) return res.status(404).json({ error: 'Collection not found.' });
  res.status(201).json(await Model.create(req.body));
}));
app.put('/api/:collection/:id', asyncRoute(async (req, res) => {
  const Model = models[req.params.collection];
  if (!Model) return res.status(404).json({ error: 'Collection not found.' });
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' });
  const row = await Model.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true, context: 'query' });
  if (!row) return res.status(404).json({ error: `${labels[req.params.collection]} not found.` });
  res.json(row);
}));
app.delete('/api/:collection/:id', asyncRoute(async (req, res) => {
  const Model = models[req.params.collection];
  if (!Model) return res.status(404).json({ error: 'Collection not found.' });
  if (!validId(req.params.id)) return res.status(400).json({ error: 'Invalid record ID.' });
  const row = await Model.findByIdAndDelete(req.params.id);
  if (!row) return res.status(404).json({ error: `${labels[req.params.collection]} not found.` });
  res.json({ message: `${labels[req.params.collection]} deleted.` });
}));

app.use(express.static(path.join(__dirname, 'public')));
app.use((err, req, res, next) => {
  if (err.code === 11000) return res.status(409).json({ error: 'That record ID is already in use.' });
  if (err.name === 'ValidationError' || err.name === 'CastError') return res.status(400).json({ error: err.message });
  console.error(err);
  res.status(500).json({ error: 'Something went wrong. Please try again.' });
});

const port = process.env.PORT || 3000;
mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/community_water_supply')
  .then(() => app.listen(port, () => console.log(`Community Water Supply is running at http://localhost:${port}`)))
  .catch(err => { console.error('Could not connect to MongoDB:', err.message); process.exit(1); });
