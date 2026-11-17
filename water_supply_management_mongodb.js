// NOSQL DB MID-SEMESTER PROJECT
// Community Water Supply Management System
// Database: community_water_supply
// Execute with: mongosh < water_supply_management_mongodb.js
use community_water_supply;
// Clear only this project's collections so the sample data can be reloaded.
db.households.drop();
db.waterSources.drop();
db.waterRequests.drop();
db.deliverySchedules.drop();
// COLLECTION 1: HOUSEHOLDS (5 documents)
db.households.insertMany([
  { householdId: "HH001", headName: "Amina Nansubuga", village: "Kawempe", householdSize: 5, phone: "0701000001" },
  { householdId: "HH002", headName: "Peter Okello", village: "Bwaise", householdSize: 4, phone: "0701000002" },
  { householdId: "HH003", headName: "Grace Nakato", village: "Makerere", householdSize: 6, phone: "0701000003" },
  { householdId: "HH004", headName: "John Mugisha", village: "Kalerwe", householdSize: 3, phone: "0701000004" },
  { householdId: "HH005", headName: "Sarah Atim", village: "Kawempe", householdSize: 7, phone: "0701000005" }
]);
// COLLECTION 2: WATER SOURCES (5 documents)
db.waterSources.insertMany([
  { sourceId: "WS001", name: "Kawempe Public Tap", village: "Kawempe", sourceType: "Public tap", capacityLitres: 10000, availableLitres: 6500, operational: true },
  { sourceId: "WS002", name: "Bwaise Borehole", village: "Bwaise", sourceType: "Borehole", capacityLitres: 8000, availableLitres: 1800, operational: true },
  { sourceId: "WS003", name: "Makerere Water Tank", village: "Makerere", sourceType: "Storage tank", capacityLitres: 12000, availableLitres: 9000, operational: true },
  { sourceId: "WS004", name: "Kalerwe Community Tap", village: "Kalerwe", sourceType: "Public tap", capacityLitres: 7000, availableLitres: 0, operational: false },
  { sourceId: "WS005", name: "Kawempe Health Centre Well", village: "Kawempe", sourceType: "Protected well", capacityLitres: 5000, availableLitres: 3200, operational: true }
]);
// COLLECTION 3: WATER REQUESTS (5 documents)
db.waterRequests.insertMany([
  { requestId: "WR001", householdId: "HH001", village: "Kawempe", litresRequested: 100, requestType: "Water delivery", status: "Pending", requestedAt: ISODate("2026-10-10T08:00:00Z") },
  { requestId: "WR002", householdId: "HH002", village: "Bwaise", litresRequested: 80, requestType: "Low supply complaint", status: "In Progress", requestedAt: ISODate("2026-10-10T09:15:00Z") },
  { requestId: "WR003", householdId: "HH003", village: "Makerere", litresRequested: 120, requestType: "Water delivery", status: "Completed", requestedAt: ISODate("2026-10-11T07:30:00Z") },
  { requestId: "WR004", householdId: "HH004", village: "Kalerwe", litresRequested: 150, requestType: "Broken tap complaint", status: "Pending", requestedAt: ISODate("2026-10-11T10:45:00Z") },
  { requestId: "WR005", householdId: "HH005", village: "Kawempe", litresRequested: 90, requestType: "Water delivery", status: "Pending", requestedAt: ISODate("2026-10-12T06:50:00Z") }
]);
// COLLECTION 4: DELIVERY SCHEDULES (5 documents)
db.deliverySchedules.insertMany([
  { scheduleId: "DS001", village: "Kawempe", serviceDate: ISODate("2026-10-14T06:00:00Z"), vehicle: "WTR-001", teamLead: "Daniel", serviceType: "Water delivery", status: "Scheduled" },
  { scheduleId: "DS002", village: "Bwaise", serviceDate: ISODate("2026-10-14T08:00:00Z"), vehicle: "WTR-002", teamLead: "Mary", serviceType: "Water delivery", status: "Scheduled" },
  { scheduleId: "DS003", village: "Makerere", serviceDate: ISODate("2026-10-15T06:30:00Z"), vehicle: "WTR-003", teamLead: "Isaac", serviceType: "Tank refill", status: "Scheduled" },
  { scheduleId: "DS004", village: "Kalerwe", serviceDate: ISODate("2026-10-15T09:00:00Z"), vehicle: "WTR-004", teamLead: "Ruth", serviceType: "Tap repair", status: "Scheduled" },
  { scheduleId: "DS005", village: "Kawempe", serviceDate: ISODate("2026-10-16T07:00:00Z"), vehicle: "WTR-001", teamLead: "Daniel", serviceType: "Water delivery", status: "Completed" }
]);
// TEST 1: Display all households.
print("\n--- All households ---");
db.households.find().forEach(printjson);
// TEST 2: Find water requests that are not completed.
print("\n--- Requests not completed ---");
db.waterRequests.find({ status: { $ne: "Completed" } }).forEach(printjson);
// TEST 3: Find requests from Kawempe.
print("\n--- Requests from Kawempe ---");
db.waterRequests.find({ village: "Kawempe" }).forEach(printjson);
// TEST 4: Find operational water sources with less than 25% supply remaining.
print("\n--- Operational sources with low supply ---");
db.waterSources.find({
  operational: true,
  $expr: { $lt: [{ $divide: ["$availableLitres", "$capacityLitres"] }, 0.25] }
}).forEach(printjson);
// TEST 5: List upcoming scheduled deliveries and repairs by date.
print("\n--- Scheduled services ---");
db.deliverySchedules.find({ status: "Scheduled" }).sort({ serviceDate: 1 }).forEach(printjson);
// TEST 6: Count requests by status using aggregation.
print("\n--- Request totals by status ---");
db.waterRequests.aggregate([
  { $group: { _id: "$status", totalRequests: { $sum: 1 } } },
  { $sort: { totalRequests: -1 } }
]).forEach(printjson);
// TEST 7: Update a request after the service is completed.
db.waterRequests.updateOne(
  { requestId: "WR001" },
  { $set: { status: "Completed" } }
);
print("\n--- Updated request WR001 ---");
printjson(db.waterRequests.findOne({ requestId: "WR001" }));
// TEST 8: Add one new household.
db.households.insertOne({
  householdId: "HH006",
  headName: "David Ssemanda",
  village: "Bwaise",
  householdSize: 4,
  phone: "0701000006"
});
// FINAL CHECK: document counts after the example insert.
print("\n--- Collection counts ---");
print("households = " + db.households.countDocuments()); // 6 after example insert
print("waterSources = " + db.waterSources.countDocuments()); // 5
print("waterRequests = " + db.waterRequests.countDocuments()); // 5
print("deliverySchedules = " + db.deliverySchedules.countDocuments()); // 5
