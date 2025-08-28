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

module.exports = router;
