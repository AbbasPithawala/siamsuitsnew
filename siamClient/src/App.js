
import React from 'react'
import { useContext } from 'react';
import Header from './components/superAdmin/header/Header';
import Login from './components/login/Login';
import { BrowserRouter as Router, HashRouter, Routes, Route} from "react-router-dom";
import "./App.css"
import Dashboard from './components/superAdmin/pages/dashboard/Dashboard';
import { Context } from "./context/Context";
import ManageUserLogin from "./components/superAdmin/pages/admin/ManageUserLogin"
import ManageRetailer from "./components/superAdmin/pages/admin/ManageRetailer"
import ManageRoles from './components/superAdmin/pages/admin/ManageRoles';
import ManageProduct from './components/superAdmin/pages/admin/ManageProduct';
import ManageProcesses from './components/superAdmin/pages/admin/ManageProcesses';
import ManageMeasurements from './components/superAdmin/pages/admin/ManageMeasurements';
import ManageStyleOption from './components/superAdmin/pages/admin/ManageStyleOption';
import ManageGroupFeaturesForm from './components/superAdmin/pages/adminForm/ManageGroupFeaturesForm';
import ManageRetailStyle from './components/superAdmin/pages/admin/ManageRetailStyle';
import ManageMeasurementFits from './components/superAdmin/pages/admin/ManageMeasurementFits';
import ManagePipings from './components/superAdmin/pages/admin/ManagePipings';
import ManageReatilerPrice from './components/superAdmin/pages/admin/ManageRetailerPrice';
import ManageTailers from './components/superAdmin/pages/Factory/ManageTailers';
import ManageJobs from './components/superAdmin/pages/Factory/ManageJobs';
import ManagePositions from './components/superAdmin/pages/Factory/ManagePositions';
import ManageExtraPayments from './components/superAdmin/pages/Factory/ManageExtraPayments';
import ManagePaymentCategories from './components/superAdmin/pages/Factory/ManagePaymentCategories';
import FactoryWorkerBarcoding from './components/superAdmin/pages/Factory/FactoryWorkerBarcoding';
import PaymentSummary from './components/superAdmin/pages/Factory/PaymentSummary';
import WorkPaymentHistory from './components/superAdmin/pages/Factory/WorkPaymentHistory';
import AddWorkAdvancePayment from './components/superAdmin/pages/Factory/AddWorkAdvancePayment';
import WorkAdvancePaymentHistory from './components/superAdmin/pages/Factory/WorkAdvancePaymentHistory';
import Sidebar from './components/superAdmin/sidebar/Sidebar';
import ShippingBoxReport from './components/superAdmin/pages/shopping/ShippingBoxReport';
import OrderStatusBarcoding from './components/superAdmin/pages/shopping/OrderStatusBarcoding';
import CreateInvoice from './components/superAdmin/pages/invoice/CreateInvoice';
import InvoiceHistory from './components/superAdmin/pages/invoice/InvoiceHistory';
import PaidInvoice from './components/superAdmin/pages/invoice/PaidInvoice';
import ManageRoleFrom from './components/superAdmin/pages/adminForm/ManageRoleForm';
import ManageRoleFormEdit from './components/superAdmin/pages/adminForm/ManageRoleFormEdit';
import ManageUserForm from './components/superAdmin/pages/adminForm/ManageUserForm';
import ManageUserFormEdit from './components/superAdmin/pages/adminForm/ManageUserFormEdit';
import ManageRetailerForm from './components/superAdmin/pages/adminForm/ManageRetailerForm';
import ManageRetailerFormEdit from './components/superAdmin/pages/adminForm/ManageRetailerFormEdit';
import ManageStyleOptionFrom from './components/superAdmin/pages/adminForm/ManageStyleOptionForm';
import ManageStyleOptionFormEdit from './components/superAdmin/pages/adminForm/ManageStyleOptionFormEdit';
import ManageProductForm from './components/superAdmin/pages/adminForm/ManageProductForm';
import ManageProductFormEdit from './components/superAdmin/pages/adminForm/ManageProductFormEdit';
import SearchOrder from './components/superAdmin/pages/order/SearchOrder';
// import NewOrder from './components/superAdmin/pages/order/NewOrder';
import ManualOrder from './components/superAdmin/pages/order/ManualOrder';
import Add from './components/superAdmin/pages/order/Add';
import View from './components/superAdmin/pages/order/View';
import RetailerHeader from './components/retailerAdmin/RetailerHeader/RetailerHeader';
import RetailerSidebar from './components/retailerAdmin/RetailerSidebar/RetailerSidebar';
import RetailerDashboard from './components/retailerAdmin/retailerPages/dashboard/Dashboard';
import RetailerProfile from './components/retailerAdmin/retailerPages/RetailerProfile/RetailerProfile';
import PendingOrder from './components/retailerAdmin/retailerPages/Order/PendingOrder';
import Shipment from './components/retailerAdmin/retailerPages/Shipment/Shipment'
import NewCustomer from './components/retailerAdmin/retailerPages/newCustomer/NewCustomer';
import ProductList from './components/retailerAdmin/retailerPages/Step4/Step4';
import RetailerInvoiceHistory from './components/retailerAdmin/retailerPages/Invoice/InvoiceHistory'
import ManageMeasurementsForm from './components/superAdmin/pages/adminForm/ManageMeasurementsForm';
import ManageMeasurementsFormEdit from './components/superAdmin/pages/adminForm/ManageMeasurementFormEdit';
import ManageEditStyling from './components/superAdmin/pages/adminForm/ManageEditStyling';
import ManageMeasurementFitForm from './components/superAdmin/pages/adminForm/ManageMeasurementFitForm';
import ManageMeasurementFitProdcutForm from './components/superAdmin/pages/admin/ManageMeasurementFitsProduct'
import ManageMeasurementFitEditForm from './components/superAdmin/pages/adminForm/ManageMeasurementFitEditForm'
import ManagePipingForm from './components/superAdmin/pages/adminForm/ManagePipingForm';
import ManageEditPipingForm from './components/superAdmin/pages/adminForm/ManageEditPiping';
import ViewCustomer from './components/retailerAdmin/retailerPages/newCustomer/ViewCustomer'
import EditOrder from "./components/retailerAdmin/retailerPages/Order/editOrder";
import CustomerOrder from "./components/retailerAdmin/retailerPages/customerOrder/CustomerOrder";
import EditCustomer from './components/retailerAdmin/retailerPages/newCustomer/EditCutomer';
import EditOrderWithManualSize from './components/superAdmin/pages/order/editOrderWithManualSize';
import ManagePositionForm from './components/superAdmin/pages/factoryForm/ManagePositionForm';
import ManageTailerForm from './components/superAdmin/pages/factoryForm/ManageTailerForm';
import ManagePositionEdit from './components/superAdmin/pages/factoryForm/ManagePositionEdit';
import RepeatOrder from "./components/retailerAdmin/retailerPages/Order/RepeatOrder";
import ManageTailerEdit from "./components/superAdmin/pages/factoryForm/ManageTailerEdit";
import NewGroupOrder from "./components/retailerAdmin/retailerPages/Group/newOrder/NewOrder"
import ViewGroupOrder from "./components/retailerAdmin/retailerPages/Group/orders/Orders"
import ViewSingleGroupOrderCustomers from "./components/retailerAdmin/retailerPages/Group/orders/SingleOrderCustomerDetails"
import ViewSingleGroupOrderCustomersAdmin from "./components/superAdmin/pages/groupOrder/SingleOrderCustomerDetails"
import ManageGroupStyling from './components/superAdmin/pages/admin/ManageGroupStyle';
import ManageGroupFeaturesEdit from './components/superAdmin/pages/adminForm/ManageGroupFeaturesEdit';
import AssignItem from './components/superAdmin/pages/Factory/AssignItem';

import GroupOrder from "./components/superAdmin/pages/groupOrder/GroupOrder"
import CustomerManualSize from "./components/superAdmin/pages/groupOrder/ManualMeasurementsSize"

// admin routes for order module to be changed===================================
import NewOrder from './components/superAdmin/pages/order/Order';
import SingleOrder from './components/retailerAdmin/retailerPages/singleOrder/SingleOrder';

function App() {

const { user, isLoggedIn } = useContext(Context);


return (
    <>
      {user ?

        user.data.type == "retailer" ?

          <HashRouter >
            <RetailerHeader />
            <div className="Main-page-body-wrapper-complussry">
              <RetailerSidebar />
              <Routes>
                <Route exact path="/" element={<RetailerDashboard />}></Route>
                <Route exact path="/retailer/newCustomer" element={<NewCustomer />}></Route>
                <Route exact path="/retailer/retailershipment" element={<Shipment />}></Route>
                <Route exact path="/retailer/productList/:id" element={<ProductList />}></Route>
                <Route exact path="/retailer/invoicehistory" element={<RetailerInvoiceHistory />}></Route>
                <Route exact path="/retailer/viewCustomers" element={<ViewCustomer />}></Route>

                <Route exact path="/retailer/retailerProfile" element={<RetailerProfile/>}></Route>
                <Route exact path="/retailer/customerOrders/:id" element={<CustomerOrder />}></Route>

                <Route exact path="/retailer/editOrder/:id" element={<EditOrder />}></Route>
                <Route exact path="/retailer/RepeatOrder/:id" element={<RepeatOrder />}></Route>
                <Route exact path="/retailer/editCustomer/:id" element={<EditCustomer />}></Route>
                <Route exact path="/retailer/newGroupOrder" element={<NewGroupOrder />}></Route>
                <Route exact path="/retailer/editGroupOrder/:id" element={<NewGroupOrder />}></Route>
                <Route exact path="/retailer/repeatGroupOrder/:id" element={<NewGroupOrder />}></Route>
                <Route exact path="/retailer/viewGroupOrder" element={<ViewGroupOrder />}></Route>
                <Route exact path="/retailer/viewSingleGroupOrderCustomers/:id" element={<ViewSingleGroupOrderCustomers />}></Route>
                <Route exact path="/retailer/editCustomer" element={<EditCustomer />}></Route>
                <Route exact path="/retailer/searchOrder/:id" element={<SingleOrder/>}></Route>
              </Routes>
            </div>
          </HashRouter>

          :

          <HashRouter >
            <Header />
            <div className="Main-page-body-wrapper-complussry">
              <Sidebar />
              <Routes>
                {/* <Route exact path="/" element={ <Dashboard/> }></Route> */}
                <Route exact path="/" element={<NewOrder />}></Route>
                <Route exact path="/admin/roles" element={<ManageRoles />}></Route>
                <Route exact path="/admin/userlogin" element={<ManageUserLogin />}></Route>
                <Route exact path="/admin/retailer" element={<ManageRetailer />}></Route>
                <Route exact path="/admin/product" element={<ManageProduct />}></Route>
                <Route exact path="/admin/process" element={<ManageProcesses />}></Route>
                <Route exact path="/admin/measurements" element={<ManageMeasurements />}></Route>
                <Route exact path="/admin/styleoption" element={<ManageStyleOption />}></Route>
                <Route exact path="/admin/retailstyle" element={<ManageRetailStyle />}></Route>
                <Route exact path="/admin/measurementfits" element={<ManageMeasurementFits />}></Route>
                <Route exact path="/admin/pipings" element={<ManagePipings />}></Route>
                <Route exact path="/admin/addRole" element={<ManageRoleFrom />}></Route>
                <Route exact path="/admin/addRole/:id" element={<ManageRoleFormEdit />}></Route>
                <Route exact path="/admin/addUser" element={<ManageUserForm />}></Route>
                <Route exact path="/admin/addUser/:id" element={<ManageUserFormEdit />}></Route>
                <Route exact path="/admin/addRetailer" element={<ManageRetailerForm />}></Route>
                <Route exact path="/admin/addRetailer/:id" element={<ManageRetailerFormEdit />}></Route>
                <Route exact path="/admin/addProduct" element={<ManageProductForm />}></Route>
                <Route exact path="/admin/addPiping" element={<ManagePipingForm />}></Route>
                <Route exact path="/admin/addProduct/:id" element={<ManageProductFormEdit />}></Route>
                <Route exact path="/admin/editPiping/:id" element={<ManageEditPipingForm />}></Route>
                <Route exact path="/admin/addStyleOption" element={<ManageStyleOptionFrom />}></Route>
                <Route exact path="/admin/addStyleOption/:id" element={<ManageStyleOptionFormEdit />}></Route>
                <Route exact path="/admin/addGroupStyle" element={<ManageGroupFeaturesForm />}></Route>
                <Route exact path="/admin/editGroupStyle/:id" element={<ManageGroupFeaturesEdit />}></Route>
                <Route exact path="/admin/GroupStyle" element={<ManageGroupStyling />}></Route>
                <Route exact path="/admin/addMeasurement" element={<ManageMeasurementsForm />}></Route>
                <Route exact path="/admin/addMeasurement/:id" element={<ManageMeasurementsFormEdit />}></Route>
                <Route exact path="/admin/editStyling/:id" element={<ManageEditStyling />}></Route>
                <Route exact path="/admin/addMeasurementFit" element={<ManageMeasurementFitForm />}></Route>
                <Route exact path="/admin/productMeasurementFit/:id" element={<ManageMeasurementFitProdcutForm />}></Route>
                <Route exact path="/admin/productMeasurementFitEdit/:id" element={<ManageMeasurementFitEditForm />}></Route>
                <Route exact path="/admin/editOrder/:id" element={<EditOrder />}></Route>
                <Route exact path="/factory/tailers" element={<ManageTailers />}></Route>
                <Route exact path="/factory/AssignItem" element={<AssignItem />}></Route>
                
                <Route exact path="/factory/jobs" element={<ManageJobs />}></Route>
                <Route exact path="/factory/positions" element={<ManagePositions />}></Route>
                <Route exact path="/factory/extrapayments" element={<ManageExtraPayments />}></Route>
                <Route exact path="/factory/paymentcategories" element={<ManagePaymentCategories />}></Route>
                <Route exact path="/factory/workerbarcoding" element={<FactoryWorkerBarcoding />}></Route>
                <Route exact path="/factory/paymentsummary" element={<PaymentSummary />}></Route>
                <Route exact path="/factory/paymenthistory" element={<WorkPaymentHistory />}></Route>
                <Route exact path="/factory/advancepayment" element={<AddWorkAdvancePayment />}></Route>
                <Route exact path="/factory/advancepaymenthistory" element={<WorkAdvancePaymentHistory />}></Route>
                <Route exact path="/factory/addPosition" element={<ManagePositionForm />}></Route>
                <Route exact path="/factory/editPosition/:id" element={<ManagePositionEdit />}></Route>
                <Route exact path="/factory/addTailer" element={<ManageTailerForm />}></Route>
                <Route exact path="/factory/editTailer/:id" element={<ManageTailerEdit />}></Route>

                <Route exact path="/order/searchOrder" element={<SearchOrder />}></Route>
                <Route exact path="/order/newOrder" element={<NewOrder />}></Route>
                <Route exact path="/order/manualOrder" element={<ManualOrder />}></Route>
                <Route exact path="/order/add" element={<Add />}></Route>
                <Route exact path="/order/view" element={<View />}></Route>
                <Route exact path="/groupOrder/GroupOrder" element={<GroupOrder />}></Route>
                <Route exact path="/invoice/createinvoice" element={<CreateInvoice />}></Route>
                <Route exact path="/invoice/invoicehistory" element={<InvoiceHistory />}></Route>
                <Route exact path="/invoice/paidinvoice" element={<PaidInvoice />}></Route>
                <Route exact path="/shipping/shippingboxreport" element={<ShippingBoxReport />}></Route>
                <Route exact path="/shipping/orderstatusbarcoding" element={<OrderStatusBarcoding />}></Route>
                <Route exact path="/admin/edit-Order/:id" element={<EditOrderWithManualSize />}></Route>  
                <Route exact path="/admin/editGroupOrder/:id" element={<NewGroupOrder />}></Route>   
                <Route exact path="/admin/viewSingleGroupOrderCustomers/:id" element={<ViewSingleGroupOrderCustomersAdmin />}></Route>
                <Route exact path="/groupOrder/ManualMeasurements/:id/:order" element={<CustomerManualSize />}></Route>              
                {/* <Route exact path="/admin/NewOrderTemp" element={<TempOrders />}></Route> */}
              </Routes>
            </div>
          </HashRouter>

        :

        <HashRouter >
          <Routes>
            <Route exact path="/" element={<Login />}></Route>
            <Route exact path="/admin/roles" element={<Login />}></Route>
            <Route exact path="/admin/userlogin" element={<Login />}></Route>
            <Route exact path="/admin/retailer" element={<Login />}></Route>
            <Route exact path="/admin/product" element={<Login />}></Route>            
            <Route exact path="/admin/process" element={<Login />}></Route>
            <Route exact path="/admin/measurements" element={<Login />}></Route>
            <Route exact path="/admin/styleoption" element={<Login />}></Route>
            <Route exact path="/admin/retailstyle" element={<Login />}></Route>
            <Route exact path="/admin/measurementfits" element={<Login />}></Route>
            <Route exact path="/admin/pipings" element={<Login />}></Route>
            <Route exact path="/admin/addRole" element={<Login />}></Route>
            <Route exact path="/admin/addRole/:id" element={<Login />}></Route>
            <Route exact path="/admin/addUser" element={<Login />}></Route>
            <Route exact path="/admin/addUser/:id" element={<Login />}></Route>
            <Route exact path="/admin/addRetailer" element={<Login />}></Route>
            <Route exact path="/admin/addRetailer/:id" element={<Login />}></Route>
            <Route exact path="/admin/addProduct" element={<Login />}></Route>
            <Route exact path="/admin/addProduct/:id" element={<Login />}></Route>
            <Route exact path="/admin/addStyleOption" element={<Login />}></Route>
            <Route exact path="/admin/addStyleOption/:id" element={<Login />}></Route>
            <Route exact path="/admin/addMeasurement" element={<Login />}></Route>
            <Route exact path="/admin/addMeasurement/:id" element={<Login />}></Route>
            <Route exact path="/admin/editStyling/:id" element={<Login />}></Route>
            <Route exact path="/admin/addPiping" element={<Login />}></Route>
            <Route exact path="/admin/addMeasurementFit" element={<Login />}></Route>
            <Route exact path="/factory/workers" element={<Login />}></Route>
            <Route exact path="/factory/jobs" element={<Login />}></Route>
            <Route exact path="/factory/positions" element={<Login />}></Route>
            <Route exact path="/factory/extrapayments" element={<Login />}></Route>
            <Route exact path="/factory/paymentcategories" element={<Login />}></Route>
            <Route exact path="/factory/paymentsummary" element={<Login />}></Route>
            <Route exact path="/factory/paymenthistory" element={<Login />}></Route>
            <Route exact path="/factory/advancepayment" element={<Login />}></Route>
            <Route exact path="/factory/advancepaymenthistory" element={<Login />}></Route>
            <Route exact path="/factory/AssignItem" element={<Login />}></Route>
            <Route exact path="/order/searchOrder" element={<Login />}></Route>
            <Route exact path="/order/newOrder" element={<Login />}></Route>
            <Route exact path="/order/modified" element={<Login />}></Route>
            <Route exact path="/order/processing" element={<Login />}></Route>
            <Route exact path="/order/readyforShipping" element={<Login />}></Route>
            <Route exact path="/order/sent" element={<Login />}></Route>
            <Route exact path="/order/manualOrder" element={<Login />}></Route>
            <Route exact path="/order/add" element={<Login />}></Route>
            <Route exact path="/order/view" element={<Login />}></Route>
            <Route exact path="/order/completedOrder" element={<Login />}></Route>
            <Route exact path="/invoice/createinvoice" element={<Login />}></Route>
            <Route exact path="/invoice/invoicehistory" element={<Login />}></Route>
            <Route exact path="/invoice/paidinvoice" element={<Login />}></Route>
            <Route exact path="/shipping/shippingboxreport" element={<Login />}></Route>
            <Route exact path="/shipping/orderstatusbarcoding" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/orderplaced" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/pendingOrder" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/retailerprocessing" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/retailershippingready" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/retailersent" element={<Login />}></Route>
            <Route exact path="/retailerDashboard/retailerModified" element={<Login />}></Route>
            <Route exact path="/retailer/newCustomer" element={<Login />}></Route>
            <Route exact path="/retailer/retailerProfile" element={<Login />}></Route>
            <Route exact path="/retailer/retailershipment" element={<Login />}></Route>
            <Route exact path="/retailer/missingfabric" element={<Login />}></Route>
            <Route exact path="/retailer/productList/:id" element={<Login />}></Route>
            <Route exact path="/retailer/invoicehistory" element={<Login />}></Route>
            <Route exact path="/retailer/viewCustomers" element={<Login />}></Route>
            <Route exact path="/retailer/editOrder/:id" element={<Login />}></Route>
            <Route exact path="/retailer/customerOrders/:id" element={<Login />}></Route>
            <Route exact path="/retailer/editCustomer/:id" element={<Login />}></Route>
            <Route exact path="/admin/editOrder/:id" element={<Login />}></Route>
            <Route exact path="/retailer/RepeatOrder/:id" element={<Login />}></Route>
            <Route exact path="/factory/addPosition" element={<Login />}></Route>
            <Route exact path="/factory/editPosition/:id" element={<Login />}></Route>
            <Route exact path="/factory/addTailer" element={<Login />}></Route>
            <Route exact path="/factory/editTailer/:id" element={<Login />}></Route>
            <Route exact path="/admin/edit-Order/:id" element={<Login />}></Route>
            <Route exact path="/retailer/createGroupOrder" element={<Login />}></Route>
            <Route exact path="/retailer/viewGroupOrder" element={<Login />}></Route>
            <Route exact path="/retailer/viewSingleGroupOrderCustomers/:id" element={<Login />}></Route>            
            <Route exact path="/admin/viewSingleGroupOrderCustomers/:id" element={<Login />}></Route>
            <Route exact path="/admin/addGroupStyle" element={<Login />}></Route>
            <Route exact path="/admin/GroupStyle" element={<Login />}></Route>
            <Route exact path="/admin/editGroupStyle/:id" element={<Login />}></Route>
            <Route exact path="/retailer/editGroupOrder/:id" element={<Login />}></Route>
            <Route exact path="/retailer/placeGroupOrder" element={<Login />}></Route>
            <Route exact path="/retailer/editCustomer" element={<Login />}></Route>
            <Route exact path="/retailer/readyForShippingGroupOrder" element={<Login />}></Route>
            <Route exact path="/retailer/sentGroupOrder" element={<Login />}></Route>
            <Route exact path="/retailer/suitmissingfabric" element={<Login />}></Route>
            <Route exact path="/retailer/profile" element={<Login/>}></Route>
            <Route exact path="/retailer/editGroupOrder/:id" element={<Login/>}></Route>
            <Route exact path="/retailer/repeatGroupOrder/:id" element={<Login/>}></Route>
            <Route exact path="/retailer/viewGroupOrder" element={<Login />}></Route>
            <Route exact path="/groupOrder/GroupOrder" element={<Login />}></Route>
            <Route exact path="/factory/tailers" element={<Login />}></Route>

            <Route exact path="/retailerDashboard/retailerRush" element={<Login />}></Route>

            <Route exact path="/order/rushOrder" element={<Login />}></Route>
          </Routes>
        </HashRouter>
      }
    </>

  );
}

export default App;
