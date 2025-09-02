const express = require("express");
const router = express.Router();
const auth = require("../../middleware/auth");
const catchAsync = require('../../utills/catchAsync');
const AppError = require('../../utills/appError');
const mongoose = require("mongoose");

// Import required models
const Order = require("../model/model.Order");
const GroupOrder = require("../model/model.groupOrder");
const Jobs = require("../../admin/model/factoryModel/model.jobs");
const ExtraPayments = require("../../admin/model/factoryModel/model.extraPayments");
const Customer = require("../model/model.customerMeasurement");
const DraftMeasurements = require("../model/model.draftedMeasurements");
const Retailer = require("../../admin/model/model.retailer");
const Measurement = require("../../admin/model/model.measurement");
const { generateUniqueSlug } = require("../../utills/common");

/**
 * Delete a retailer and cascade delete all their orders, jobs, extra payments, customers, and drafted measurements
 * POST /api/retailerOrderManagement/deleteRetailer
 * Body: { retailer_id: ObjectId }
 */
router.post("/deleteRetailer", catchAsync(async (req, res, next) => {
    const { retailer_id } = req.body;

    // Validate retailer_id
    if (!retailer_id) {
        return res.status(400).json({
            status: false,
            message: "retailer_id is required",
            data: null
        });
    }

    // Validate retailer_id format
    if (!mongoose.Types.ObjectId.isValid(retailer_id)) {
        return res.status(400).json({
            status: false,
            message: "Invalid retailer_id format",
            data: null
        });
    }

    try {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        let deletedCounts = {
            orders: 0,
            groupOrders: 0,
            jobs: 0,
            extraPayments: 0,
            customers: 0,
            draftMeasurements: 0,
            retailer: 0
        };

        try {
            // Step 1: Find the retailer to get retailer_code
            const retailer = await Retailer.findById(retailer_id).session(session);
            if (!retailer) {
                await session.abortTransaction();
                return res.status(404).json({
                    status: false,
                    message: "Retailer not found",
                    data: null
                });
            }
            const retailer_code = retailer.retailer_code;

            // Step 2: Find all orders for this retailer
            const orders = await Order.find({ retailer_id: retailer_id }).session(session);
            const orderIds = orders.map(order => order._id);
            
            // Step 3: Find all group orders for this retailer
            const groupOrders = await GroupOrder.find({ retailer_id: retailer_id }).session(session);
            const groupOrderIds = groupOrders.map(groupOrder => groupOrder._id);

            // Step 4: Delete all extra payments related to these orders and group orders
            const extraPaymentDeleteResult = await ExtraPayments.deleteMany({
                $or: [
                    { order_id: { $in: orderIds } },
                    { group_order_id: { $in: groupOrderIds } }
                ]
            }).session(session);
            deletedCounts.extraPayments = extraPaymentDeleteResult.deletedCount;

            // Step 5: Delete all jobs related to these orders and group orders
            const jobDeleteResult = await Jobs.deleteMany({
                $or: [
                    { order_id: { $in: orderIds } },
                    { group_order_id: { $in: groupOrderIds } }
                ]
            }).session(session);
            deletedCounts.jobs = jobDeleteResult.deletedCount;

            // Step 6: Delete all drafted measurements for this retailer
            const draftMeasurementsDeleteResult = await DraftMeasurements.deleteMany({ 
                retailer_code: retailer_code 
            }).session(session);
            deletedCounts.draftMeasurements = draftMeasurementsDeleteResult.deletedCount;

            // Step 7: Delete all customers for this retailer
            const customerDeleteResult = await Customer.deleteMany({ 
                retailer_code: retailer_code 
            }).session(session);
            deletedCounts.customers = customerDeleteResult.deletedCount;

            // Step 8: Delete all group orders for this retailer
            const groupOrderDeleteResult = await GroupOrder.deleteMany({ 
                retailer_id: retailer_id 
            }).session(session);
            deletedCounts.groupOrders = groupOrderDeleteResult.deletedCount;

            // Step 9: Delete all orders for this retailer
            const orderDeleteResult = await Order.deleteMany({ 
                retailer_id: retailer_id 
            }).session(session);
            deletedCounts.orders = orderDeleteResult.deletedCount;

            // Step 10: Finally, delete the retailer itself
            const retailerDeleteResult = await Retailer.deleteOne({ 
                _id: retailer_id 
            }).session(session);
            deletedCounts.retailer = retailerDeleteResult.deletedCount;

            // Commit the transaction
            await session.commitTransaction();

            return res.status(200).json({
                status: true,
                message: "Retailer and all associated data deleted successfully",
                data: {
                    retailer_id: retailer_id,
                    retailer_code: retailer_code,
                    deleted_counts: deletedCounts,
                    total_deleted: deletedCounts.orders + deletedCounts.groupOrders + deletedCounts.jobs + deletedCounts.extraPayments + deletedCounts.customers + deletedCounts.draftMeasurements + deletedCounts.retailer
                }
            });

        } catch (error) {
            // Rollback the transaction on error
            await session.abortTransaction();
            throw error;
        } finally {
            // End the session
            session.endSession();
        }

    } catch (error) {
        console.error("Error deleting retailer orders:", error);
        
        return res.status(500).json({
            status: false,
            message: "An error occurred while deleting retailer and associated data",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            data: null
        });
    }
}));

/**
 * Get count of retailer, orders, customers, and related data for a retailer (for verification before deletion)
 * GET /api/retailerOrderManagement/getRetailerDataCounts/:retailer_id
 */
router.get("/getRetailerDataCounts/:retailer_id", auth, catchAsync(async (req, res, next) => {
    const { retailer_id } = req.params;

    // Validate retailer_id format
    if (!mongoose.Types.ObjectId.isValid(retailer_id)) {
        return res.status(400).json({
            status: false,
            message: "Invalid retailer_id format",
            data: null
        });
    }

    try {
        // Find the retailer to get retailer_code
        const retailer = await Retailer.findById(retailer_id);
        if (!retailer) {
            return res.status(404).json({
                status: false,
                message: "Retailer not found",
                data: null
            });
        }
        const retailer_code = retailer.retailer_code;

        // Count orders
        const orderCount = await Order.countDocuments({ retailer_id: retailer_id });
        
        // Count group orders
        const groupOrderCount = await GroupOrder.countDocuments({ retailer_id: retailer_id });

        // Count customers
        const customerCount = await Customer.countDocuments({ retailer_code: retailer_code });

        // Count drafted measurements
        const draftMeasurementCount = await DraftMeasurements.countDocuments({ retailer_code: retailer_code });

        // Get order and group order IDs for counting related data
        const orders = await Order.find({ retailer_id: retailer_id }, '_id');
        const orderIds = orders.map(order => order._id);
        
        const groupOrders = await GroupOrder.find({ retailer_id: retailer_id }, '_id');
        const groupOrderIds = groupOrders.map(groupOrder => groupOrder._id);

        // Count jobs
        const jobCount = await Jobs.countDocuments({
            $or: [
                { order_id: { $in: orderIds } },
                { group_order_id: { $in: groupOrderIds } }
            ]
        });

        // Count extra payments
        const extraPaymentCount = await ExtraPayments.countDocuments({
            $or: [
                { order_id: { $in: orderIds } },
                { group_order_id: { $in: groupOrderIds } }
            ]
        });

        return res.status(200).json({
            status: true,
            message: "Retailer and associated data counts retrieved successfully",
            data: {
                retailer_id: retailer_id,
                retailer_code: retailer_code,
                retailer_name: retailer.retailer_name,
                counts: {
                    retailer: 1, // Always 1 if retailer exists
                    orders: orderCount,
                    groupOrders: groupOrderCount,
                    jobs: jobCount,
                    extraPayments: extraPaymentCount,
                    customers: customerCount,
                    draftMeasurements: draftMeasurementCount
                },
                total: 1 + orderCount + groupOrderCount + jobCount + extraPaymentCount + customerCount + draftMeasurementCount
            }
        });

    } catch (error) {
        console.error("Error getting order counts:", error);
        
        return res.status(500).json({
            status: false,
            message: "An error occurred while getting retailer and associated data counts",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            data: null
        });
    }
}));

/**
 * Transform measurement keys from l/r abbreviations to left/right full forms (Test on single customer)
 * POST /api/retailerOrderManagement/transformMeasurementKeys
 * Body: { customer_id: ObjectId } - Optional: if provided, only transforms this customer and their orders
 */
router.post("/transformMeasurementKeys", catchAsync(async (req, res, next) => {
    const { customer_id } = req.body;
    try {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        let transformedCounts = {
            orders: 0,
            customers: 0,
            totalKeysTransformed: 0
        };

        try {
            // Helper function to transform measurement keys in a measurements object
            const transformMeasurementKeys = (measurementsObj) => {
                if (!measurementsObj || !measurementsObj.shirt || !measurementsObj.shirt.measurements) {
                    return { transformed: false, keysTransformed: 0 };
                }

                const shirtMeasurements = measurementsObj.shirt.measurements;
                let keysTransformed = 0;
                let hasChanges = false;

                // Define the transformation mappings - both cuff and cuffs map to the same target
                const keyTransformations = {
                    'shirt l cuff': 'shirt left cuff',
                    'shirt l cuffs': 'shirt left cuff',
                    'shirt r cuff': 'shirt right cuff', 
                    'shirt r cuffs': 'shirt right cuff',
                    'shirt l sleeve': 'shirt left sleeve',
                    'shirt r sleeve': 'shirt right sleeve'
                };

                // Process each transformation - only modify the specific target keys
                Object.keys(keyTransformations).forEach(oldKey => {
                    const newKey = keyTransformations[oldKey];
                    
                    if (shirtMeasurements.hasOwnProperty(oldKey)) {
                        // If the new key doesn't exist, copy the old key's data to the new key
                        if (!shirtMeasurements.hasOwnProperty(newKey)) {
                            shirtMeasurements[newKey] = { ...shirtMeasurements[oldKey] };
                            keysTransformed++;
                            hasChanges = true;
                        } else {
                            // If new key exists, we're just removing the duplicate old key
                            // Don't overwrite existing data, just mark as changed for cleanup
                            hasChanges = true;
                        }
                        // Remove the old abbreviated key
                        delete shirtMeasurements[oldKey];
                    }
                });

                // Additional cleanup: Remove any remaining keys that contain "cuffs" (plural)
                Object.keys(shirtMeasurements).forEach(key => {
                    if (key.includes('cuffs') && key !== 'shirt left cuff' && key !== 'shirt right cuff') {
                        delete shirtMeasurements[key];
                        hasChanges = true;
                    }
                });

                return { transformed: hasChanges, keysTransformed };
            };

            let orders, customers;
            
            if (customer_id) {
                // Validate customer_id format
                if (!mongoose.Types.ObjectId.isValid(customer_id)) {
                    await session.abortTransaction();
                    return res.status(400).json({
                        status: false,
                        message: "Invalid customer_id format",
                        data: null
                    });
                }

                // Test mode: Transform only the specified customer and their orders
                customers = await Customer.find({ _id: customer_id }).session(session);
                if (customers.length === 0) {
                    await session.abortTransaction();
                    return res.status(404).json({
                        status: false,
                        message: "Customer not found",
                        data: null
                    });
                }

                // Find orders for this specific customer (assuming there's a customer_id field in orders)
                // If orders don't have customer_id, we'll find by customer phone or other identifier
                const customer = customers[0];
                orders = await Order.find({ 
                    $or: [
                        { customer_id: customer_id },
                        { customer_phone: customer.phone },
                        { customer_name: customer.customer_name }
                    ]
                }).session(session);
            } else {
                // Original mode: Transform all orders and customers
                orders = await Order.find({}).session(session);
                customers = await Customer.find({}).session(session);
            }

            // Transform Orders
            for (const order of orders) {
                if (order.measurements) {
                    const result = transformMeasurementKeys(order.measurements);
                    if (result.transformed) {
                        await Order.updateOne(
                            { _id: order._id },
                            { $set: { measurements: order.measurements } }
                        ).session(session);
                        transformedCounts.orders++;
                        transformedCounts.totalKeysTransformed += result.keysTransformed;
                    }
                }
            }

            // Transform Customers
            for (const customer of customers) {
                if (customer.measurementsObject) {
                    const result = transformMeasurementKeys(customer.measurementsObject);
                    if (result.transformed) {
                        await Customer.updateOne(
                            { _id: customer._id },
                            { $set: { measurementsObject: customer.measurementsObject } }
                        ).session(session);
                        transformedCounts.customers++;
                        transformedCounts.totalKeysTransformed += result.keysTransformed;
                    }
                }
            }

            // Commit the transaction
            await session.commitTransaction();

            return res.status(200).json({
                status: true,
                message: "Measurement keys transformed successfully",
                data: {
                    test_mode: !!customer_id,
                    customer_id: customer_id || null,
                    transformed_counts: transformedCounts,
                    details: {
                        orders_processed: orders.length,
                        customers_processed: customers.length,
                        orders_modified: transformedCounts.orders,
                        customers_modified: transformedCounts.customers,
                        total_keys_transformed: transformedCounts.totalKeysTransformed
                    }
                }
            });

        } catch (error) {
            // Rollback the transaction on error
            await session.abortTransaction();
            throw error;
        } finally {
            // End the session
            session.endSession();
        }

    } catch (error) {
        console.error("Error transforming measurement keys:", error);
        
        return res.status(500).json({
            status: false,
            message: "An error occurred while transforming measurement keys",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            data: null
        });
    }
}));

/**
 * Migration: Generate slugs for existing measurements
 * POST /api/retailerOrderManagement/migrate-measurement-slugs
 */
router.post("/migrate-measurement-slugs", catchAsync(async (req, res, next) => {
    try {
        // Start a session for transaction
        const session = await mongoose.startSession();
        session.startTransaction();

        try {
            // Get all measurements that don't have slugs or have empty slugs
            const measurementsToUpdate = await Measurement.find({
                $or: [
                    { slug: { $exists: false } },
                    { slug: "" },
                    { slug: null }
                ]
            }).session(session);

            if (measurementsToUpdate.length === 0) {
                await session.commitTransaction();
                return res.status(200).json({
                    status: true,
                    message: "All measurements already have slugs!",
                    data: {
                        totalProcessed: 0,
                        updated: 0,
                        skipped: 0
                    }
                });
            }

            let updated = 0;
            let skipped = 0;
            const results = [];

            // Process each measurement
            for (let measurement of measurementsToUpdate) {
                try {
                    // Check if slug exists function
                    const checkSlugExists = async (slug) => {
                        const existingMeasurement = await Measurement.findOne({ 
                            slug: slug, 
                            _id: { $ne: measurement._id } 
                        }).session(session);
                        return !!existingMeasurement;
                    };

                    // Generate unique slug
                    const newSlug = await generateUniqueSlug(measurement.name, checkSlugExists);

                    // Update the measurement
                    await Measurement.findOneAndUpdate(
                        { _id: measurement._id }, 
                        { slug: newSlug }
                    ).session(session);

                    results.push({
                        id: measurement._id,
                        name: measurement.name,
                        slug: newSlug,
                        status: 'updated'
                    });

                    updated++;

                } catch (error) {
                    results.push({
                        id: measurement._id,
                        name: measurement.name,
                        error: error.message,
                        status: 'failed'
                    });
                    skipped++;
                }
            }

            // Commit the transaction
            await session.commitTransaction();

            return res.status(200).json({
                status: true,
                message: `Migration completed! Updated ${updated} measurements, ${skipped} failed.`,
                data: {
                    totalProcessed: measurementsToUpdate.length,
                    updated: updated,
                    skipped: skipped,
                    results: results
                }
            });

        } catch (error) {
            // Rollback the transaction on error
            await session.abortTransaction();
            throw error;
        } finally {
            // End the session
            session.endSession();
        }

    } catch (error) {
        console.error("Error migrating measurement slugs:", error);
        
        return res.status(500).json({
            status: false,
            message: "An error occurred while migrating measurement slugs",
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
            data: null
        });
    }
}));

module.exports = router;
