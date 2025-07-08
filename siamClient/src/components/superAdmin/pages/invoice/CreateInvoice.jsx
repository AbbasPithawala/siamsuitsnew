import React from "react";
import { useEffect, useState, useContext } from "react";
import './invoice.css'
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import RemoveRedEyeIcon from '@mui/icons-material/RemoveRedEye';
import EditIcon from '@mui/icons-material/Edit';
import { axiosInstance } from "./../../../../config";
import { Context } from "./../../../../context/Context";
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import { renderToString } from "react-dom/server";
import jsPDF from 'jspdf';
import Logo from '../../../../images/logo.png';
import AddCircleIcon from '@mui/icons-material/AddCircle';
import DeleteIcon from "@mui/icons-material/Delete";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";


const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});




export default function CreateInvoice() {

   const [orders, setOrders] = useState([]);
   const { user } = useContext(Context);
   const [allRetailers, setAllRetailers] = useState([]);
   const [isLoading, setIsLoading] = useState(true);
   const [ordersEmpty, setOrdersEmpty] = useState(false);
   const [startDate, setStartDate] = useState(0);
   const [endDate, setEndDate] = useState(0);
   const [open2, setOpen2] = useState(false);
   const [orderId, setOrderId] = useState("");
   const [retailer, setRetailer] = useState("");
   const [retailer_code, setRetailer_code] = useState("");
   const [singleOrder, setSingleOrder] = useState({});
   const [orderItems, setOrderItems] = useState([]);
   const [note, setNote] = useState("");
   const [totalPrice, setTotalPrice] = useState(0);
   const [invoiceTotalPrice, setInvoiceTotalPrice] = useState(0);
   const [subTotal, setSubTotal] = useState(0)
   const [discount, setDiscount] = useState(0)
   const [shippingCost, setShippingCost] = useState(0)
   const [balance, setBalance] = useState(0)
   const [id, setId] = useState("");
   const [code, setCode] = useState("");
   const [dueDate, setDueDate] = useState("")

   const [orderPrice, setOrderPrice] = useState({});
   const [extra, setExtra] = useState({});
   const [orderInvoiceArray, setOrderInvoiceArray] = useState([]);
   const [inputList, setInputList] = useState([]);
   const [success, setSuccess] = useState(false)
   const [errorMsg, setErrorMsg] = useState("")
   const [error, setError] = useState(false)
   const [showRetailers, setShowRetailers] = useState(false)
   const [open, setOpen] = useState(false)

   useEffect(() => {
      const fetchRetailers = async () => {
         const res = await axiosInstance.post("/retailer/fetchAll", { token: user.data.token })
         if(res.data.status === true){
            setShowRetailers(true)
            setAllRetailers(res.data.data)
        }
      }

      const currentDate = new Date()
      var dateFormat = currentDate.getFullYear() + "-" +((currentDate.getMonth()+1) < 10 ? "0" + (currentDate.getMonth() + 1) : (currentDate.getMonth()+1)) + "-" + (currentDate.getDate() < 10 ? "0" + currentDate.getDate() : currentDate.getDate());
      setDueDate(dateFormat)
      fetchRetailers()
   }, []);

   const handleClickOpen = async (id) => {
      setId(id);
      const res = await axiosInstance.post("/customerOrders/fetchOrderByID/" + id, { token: user.data.token });
      let orderItemsArray = [];
      if (res.data.data[0]['invoiceCreate'] === false) {
         for (let m of res.data.data[0]['order_items']) {
            for (let n = 1; n <= Object.keys(m['styles'][0]).length; n++) {
               let itemsObject = {
                  item_name: m['item_name'],
                  item_code: m['item_name'] + " " + n,
                  fabric: m['styles'][0][Object.keys(m['styles'][0])[n - 1]]['fabric_code'],
                  price: 0
               }
               if (Object.keys(m['styles'][0][Object.keys(m['styles'][0])[n - 1]]).includes('style')) {
                  for (let o of Object.keys(m['styles'][0][Object.keys(m['styles'][0])[n - 1]]['style'])) {
                     if (m['styles'][0][Object.keys(m['styles'][0])[n - 1]]['style'][o]['additional'] == "true") {
                        let styleObject = {}
                        styleObject[o] = m['styles'][0][Object.keys(m['styles'][0])[n - 1]]['style'][o];
                        styleObject[o]['price'] = 0;
                        itemsObject['styles'] = styleObject;
                     }
                  }
               }
               orderItemsArray.push(itemsObject)

            }

         }

         setOrderItems([...orderItemsArray]);
      } else {
         res.data.data[0]['invoice']['items'].map((data) => {
            orderItemsArray.push(data)
         })
         setOrderItems([...orderItemsArray]);
         setTotalPrice(res.data.data[0]['invoice']['total_amount'])
         setNote(res.data.data[0]['invoice']['note'])
         // notes[res.data.data[0]['_id']] = res.data.data[0]['invoice']['note']
         // setNotes({...notes})
      }

      // if (res.data.data.length > 0) {
      //    setSingleOrder(res.data.data[0])
      //    setOrderItems(orderItemsArray)
      // }
      setOpen2(true);
      setOrderId(id)
   };

   const handleInputChange = async (event, index) => {
      if(Number(event.target.value) < 100000){
         const { name, value } = event.target;
         const newInputList = [...orderItems];
         newInputList[index][name] = value;
         setOrderItems(newInputList);

         let price = 0
         for (let x of orderItems) {
            price = price + Number(x['price'])
            if (Object.keys(x).includes('styles')) {
               for (let m of Object.keys(x['styles'])) {
                  price = price + Number(x['styles'][m]['price'])
               }
            }
            if (Object.keys(x).includes('addition_charges')) {
               for (let m of x['additional_charges']) {
                  price = price + Number(m['price'])
               }
            }
         }

         setTotalPrice(price)
      }
   };

   const handleInputStyleChange = async (event, i) => {
      if(Number(event.taret.value) < 100000){
         let orderItemsTemp = orderItems
         for (let x of orderItemsTemp) {
            if (x['item_code'] == event.target.dataset.item) {
               x['styles'][event.target.dataset.style]['price'] = event.target.value
            }

         }
         setOrderItems(orderItemsTemp)
         let price = 0
         for (let x of orderItems) {
            price = price + Number(x['price'])
            if (Object.keys(x).includes('styles'))
               for (let m of Object.keys(x['styles'])) {
                  price = price + Number(x['styles'][m]['price'])
               }
         }

         setTotalPrice(price)
      }

   };

   const handleClose2 = () => {
      setOrderItems([]);
      setTotalPrice(0);
      setNote("");
      setOpen2(false);
   };

   const handleCreateInvoice = async () => {
      let invoice = {}
      invoice['items'] = orderItems
      invoice['total_amount'] = totalPrice
      invoice['note'] = note
      const res = await axiosInstance.post("/customerOrders/updateProductInvoice/" + id,
         {
            invoice: invoice,
            token: user.data.token
         });

      const data = {
         start_date: "",
         end_date: ""
      }

      if (res.data.status === true) {
         const res1 = await axiosInstance.post("/customerOrders/fetchFiltered/" + code, { token: user.data.token, retailer: data })
         setOrders(res1.data.data)
         setOrdersEmpty(false)
      }

      setOrderItems([]);
      setTotalPrice(0);
      setNote("");

      setOpen2(false);

   }

   const handleRetailerChange = async (e) => {
      const currentRetailer = allRetailers.filter((retailer) => {
         return retailer.retailer_code == e.target.value
      })
      setRetailer(currentRetailer[0].retailer_name);
      setRetailer_code(e.target.value);
      if (e.target.value == " ") {
         setOrders([])
      } else {
         fetchRetailerOrders(e.target.value)
      }

      setIsLoading(false)
   }

   const handleStartDateChange = (e) => {
      setStartDate(e.target.value)
      // setStartDate(new Date(e.target.value).getTime())
      // if (retailer_code == " ") {
      //    setOrders([])
      // } else {
      //    fetchRetailerOrders(new Date(e.target.value).getTime(), endDate, retailer_code)
      // }

   }

   const handleEndDateChange = (e) => {
      setEndDate(e.target.value)

      // setEndDate(new Date(e.target.value).getTime())

      // if (retailer_code == " ") {
      //    setOrders([])
      // } else {
      //    fetchRetailerOrders(startDate, new Date(e.target.value).getTime(), retailer_code)
      // }

   }

   const handleCheckBox = (e) => {
      if (e.target.checked) {
         if (!orderInvoiceArray.includes(e.target.dataset.order_id)) {
            orderInvoiceArray.push(e.target.dataset.order_id)
            setOrderInvoiceArray([...orderInvoiceArray])
            let p = calculateInvoiceTotalPrice(orderInvoiceArray)
            p = p - discount
            p = p + shippingCost
            setBalance(p)

            setSubTotal(calculateInvoiceTotalPrice(orderInvoiceArray))

         }
      } else {
         if (orderInvoiceArray.includes(e.target.dataset.order_id)) {
            let changedArray = orderInvoiceArray.filter((id) => {
               return id !== e.target.dataset.order_id
            })
            setOrderInvoiceArray(changedArray)
            let p = calculateInvoiceTotalPrice(changedArray)
            setSubTotal(p)
         }
      }
   }


   const handleShippingCostChange = (e) => {
      setShippingCost(Number(e.target.value))
      let p = calculateInvoiceTotalPrice(orderInvoiceArray)
      p = p - Number(discount)
      p = p + Number(e.target.value)
      setBalance(p)
   }

   const handleDiscountChange = (e) => {
      setDiscount(Number(e.target.value))
      let p = calculateInvoiceTotalPrice(orderInvoiceArray)
      p = p - Number(e.target.value)
      p = p + Number(shippingCost)
      setBalance(p)
   }


   const handleRetailerInvoice = async (e) => {
      const retailerInvoice = {
         retailer_code: retailer_code,
         dueDate: dueDate,
         orders: orderInvoiceArray,
         total_price: subTotal,
         shipping_charge: shippingCost,
         discount: discount,
         total_amount: balance
      }


      if(subTotal > 0 || shippingCost > 0 ||discount > 0 || balance > 0){
         const res = await axiosInstance.post('/retailerInvoice/create', { token: user.data.token, invoice: retailerInvoice });

         if(res.data.status == true){

            setOpen(true)
            setSuccess(true)
            // setErrorMsg("Please fill this input!")
            setSubTotal(0)
            setShippingCost(0)
            setBalance(0)
            setDiscount(0)


            const data = {
               start_date: "",
               end_date: ""
            }
      
            for (let x of orderInvoiceArray) {
               for (let y of orders) {
                  if (x == y['_id']) {
                     y['invoice']['sent'] = true
                     setOrders([...orders])
                  }
               }
               const res1 = await axiosInstance.put("/customerOrders/updateInvoiceStatus/" + x, { token: user.data.token })
               const res2 = await axiosInstance.post("/customerOrders/fetchFiltered/" + code, { token: user.data.token, retailer: data })
               setOrders(res2.data.data)
               setOrdersEmpty(false)
            }
   
         }else{
            setOpen(true)
            setError(true)
            setErrorMsg("Could Note create due to :- ", res.data.message)
         }

      }else{
         setOpen(true)
         setError(true)
         setErrorMsg("Please fill this input!")
      }

 

   }



   const handleClose = (event, reason) => {
      if (reason === "clickaway") {
        return;
      }
  
      setSuccess(false);
      setOpen(false)
      setError(false)
    }

   const exportPDF = async (id) => {
      const res = await axiosInstance.post("/customerOrders/fetchOrderByID/" + id, { token: user.data.token })

      let invoice = res.data.data[0].invoice
      let htmlElement = (
         <>
            <div style={{ textAlign: 'center', margin: '25px' }}>
               <table style={{ width: '725px' }} cellSpacing={0} cellPadding={2} border={0}>
                  <tbody>
                     <tr>
                        <td colSpan={3} style={{ borderBottom: '1px solid #ccc' }} valign="middle">
                           <img src={Logo} alt="logo" height="60px" />
                        </td>
                        <td colSpan={2} style={{ borderBottom: '1px solid #ccc' }}>
                           <p style={{ lineHeight: '15px', color: '#666', textAlign: 'right' }}>
                              <font style={{ fontSize: '11px', textAlign: 'right' }}>1022/87 Charoen Nakorn 34/2<br />Banglampu-Lang, Bangkok<br />10600 Thailand.</font>
                           </p>
                        </td>
                     </tr>
                     <tr style={{ backgroundColor: "white" }}>
                        <td colSpan={3}>
                           <font style={{ fontSize: '12px', color: '#26377D', fontWeight: 700 }}>
                              Retailer Name : {res.data.data[0].retailerName}
                           </font>
                        </td>
                        <td colSpan={2} style={{ textAlign: 'right' }}>
                           <font style={{ fontSize: '12px', color: '#26377D', fontWeight: 700 }}>Order Id : {res.data.data[0].orderId}</font>
                        </td>
                     </tr>
                     <tr style={{ backgroundColor: "white" }}>
                        <td colSpan={3}>
                           <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Customer Name :</font>
                           <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{res.data.data[0].customerName}</span></font>
                        </td>
                        <td colSpan={2} style={{ textAlign: 'right' }}>
                           <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Date:
                           </font>
                           <font style={{ fontSize: '12px', color: '#333', paddingLeft: "12px" }}>20 - 12 - 2022</font>
                        </td>
                     </tr>
                     <tr style={{ backgroundColor: '#26377D', padding: '10px 20px' }}>
                        <th colSpan={4} style={{ color: '#fff', lineHeight: '15px' }}>
                           <font style={{ fontSize: '12px' }}><strong> PRODUCT DESCRIPTION</strong></font>
                        </th>

                        <th colSpan={1} style={{ color: '#fff', lineHeight: '15px', textAlign: 'right' }}>
                           <font style={{ fontSize: '12px' }}><strong>PRICE</strong></font>
                        </th>
                     </tr>
                     {invoice.items.map((invoiceItem, i) => (
                        <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                           <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                              <font style={{ fontSize: '14px' }}>{invoiceItem['item_code'].toUpperCase()} in fabric from retailer
                                 <strong style={{ fontSize: "12px" }}>({invoiceItem['fabric']})</strong></font>
                           </td>
                           <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                              <font style={{ fontSize: '14px' }}>{invoiceItem['price']}</font>
                           </td>
                           {
                              invoiceItem['styles']
                                 ?
                                 Object.keys(invoiceItem['styles']).map((styles, i) => {
                                    return (
                                       <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                                          <td colSpan={4} style={{ color: "#444", fontSize: "10px", borderBottom: '1px solid #d4d4d4', fontWeight: 700 }}>{styles.toUpperCase()} ({invoiceItem['styles'][styles]['value']})</td>

                                          <td colSpan={1} style={{ textAlign: 'right', borderBottom: '1px solid #d4d4d4' }}>
                                             <font style={{ fontSize: "12px" }}>{invoiceItem['styles'][styles]['price']}</font>
                                          </td>
                                       </tr>
                                    )
                                 })
                                 :
                                 <></>
                           }
                                                      {
                              invoiceItem['additional_charges']
                                 ?
                                 Object.keys(invoiceItem['additional_charges']).map((data, i) => {
                                    return (
                                       <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                                          <td colSpan={4} style={{ color: "#444", fontSize: "10px", borderBottom: '1px solid #d4d4d4', fontWeight: 700 }}>{invoiceItem['additional_charges'][data]['name']}</td>

                                          <td colSpan={1} style={{ textAlign: 'right', borderBottom: '1px solid #d4d4d4' }}>
                                             <font style={{ fontSize: "12px" }}>{invoiceItem['additional_charges'][data]['price']}</font>
                                          </td>
                                       </tr>
                                    )
                                 })
                                 :
                                 <></>
                           }
                        </tr>
                     ))}
                     <tr style={{ backgroundColor: "#D3D3D3" }}>
                        <td colSpan={4} style={{ color: '#444', padding: '10px 15px', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                           <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Total</font>
                        </td>
                        <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right', padding: '0px 8px 0px 8px' }}>
                           <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{invoice.total_amount}</font>
                        </td>
                     </tr>
                     <tr style={{ backgroundColor: "white" }}>
                        <td colSpan={5} style={{ color: '#444' }}>
                           <font style={{ fontSize: '15px', fontWeight: '600' }}>Note : {invoice.note}</font>
                        </td>
                     </tr>
                     <tr style={{ backgroundColor: "white" }}>
                        <td colSpan={5} style={{ textAlign: 'center' }}>
                           <font style={{ color: '#26377D', fontSize: '15px', fontWeight: '600' }}>Thank You For Shopping At Siam Suits Supply</font>
                        </td>
                     </tr>
                  </tbody>
               </table>
            </div>
         </>
      )
      let elementAsString = renderToString(htmlElement);
      let doc = new jsPDF('p', 'px', [794, 1123]);
      doc.html(elementAsString, {
         callback: function (doc) {
            window.open(doc.output('bloburl'), '_blank');
         },
         x: 10,
         y: 10,
      });
   }

   const handleListAdd = (i, name) => {
      if (orderItems[i]['additional_charges']) {
         orderItems[i]['additional_charges'].push({ name: "", price: 0 })
         setOrderItems([...orderItems])
      } else {
         const newObj = {
            additional_charges: [{
               name: "",
               price: 0
            }]
         }
         orderItems[i]['additional_charges'] = newObj['additional_charges']
         setOrderItems([...orderItems])
      }
   };

   const handleAdditionalCharges = (e, i, p) => {

      if (e.target.name == 'name') {
         orderItems[i]['additional_charges'][p]['name'] = e.target.value
         setOrderItems([...orderItems])
      } else if (e.target.name == 'price') {
         if(Number(e.target.value) < 100000){
            orderItems[i]['additional_charges'][p]['price'] = e.target.value

         let price = 0

         for (let x of orderItems) {

            price = price + Number(x['price'])

            if (Object.keys(x).includes('styles')) {

               for (let m of Object.keys(x['styles'])) {
                  price = price + Number(x['styles'][m]['price'])
               }
            }
            if (Object.keys(x).includes('additional_charges')) {
               for (let m of x['additional_charges']) {
                  price = price + Number(m['price'])
               }
            }
         }
         setTotalPrice(price)

         setOrderItems([...orderItems])
         }
      }
   }

   const handleRemoveItem = (index, parent) => {
      let price = totalPrice
      price = price - Number(orderItems[index]['additional_charges'][parent]['price'])
      setTotalPrice(price)
      orderItems[index]['additional_charges'].splice(parent, 1)
      setOrderItems([...orderItems])
   };


   // static function=======================================

   const fetchRetailerOrders = async (rc) => {
      setCode(rc)
      const res = await axiosInstance.post("/customerOrders/fetchFiltered/" + rc, { token: user.data.token })

      
      if (res.data.data.length > 0) {

         if(startDate.length > 0 && !endDate.length > 0){  
            const orderArray = res.data.data.filter((job) => job.date > new Date(startDate).getTime())
            setOrders(orderArray)
            setOrdersEmpty(false)
          }
          if(!startDate.length > 0 && endDate.length > 0){
            const orderArray = res.data.data.filter((job) => job.date < new Date(endDate).getTime())
            setOrders(orderArray)
            setOrdersEmpty(false)
          }
          if(startDate.length > 0 && endDate.length > 0){
            const orderArray = res.data.data.filter((job) => {
              return  new Date(startDate).getTime() < job.date  && job.date < new Date(endDate).getTime()
            })
            setOrders(orderArray)
            setOrdersEmpty(false)
          }
          if(!startDate.length > 0 && !endDate.length > 0){
            setOrders(res.data.data)
            setOrdersEmpty(false)
          }
      } else {
         setOrdersEmpty(true)
      }
   }

   const calculateInvoiceTotalPrice = (orderInvoiceArray) => {
      let price = 0
      for (let x of orderInvoiceArray) {
         for (let y of orders) {
            if (y['_id'] == x) {
               price = price + y.invoice.total_amount
            }
         }
      }
      return price
   }



   const action = (
      <React.Fragment>
        <Button color="secondary" size="small" onClick={handleClose}>
          UNDO
        </Button>
        <IconButton
          size="small"
          aria-label="close"
          color="inherit"
          onClick={handleClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </React.Fragment>
    )
   return (
      <main className="main-panel">
         <div className="content-wrapper">
            <div className="order-table manage-page">
               <div className="top-heading-title">
                  <strong>Create Invoice</strong>
               </div>
               <div className="searchstyle searchstyle-one">
                  <div className="searchinput-inner">
                     <p>Start Date</p>
                     <input type="date" onChange={(e) => { handleStartDateChange(e) }} className="searchinput" />
                  </div>
                  <div className="searchinput-inner">

                     <p>End Date</p>
                     <input type="date" onChange={(e) => { handleEndDateChange(e) }} className="searchinput" />

                  </div>
                  <div className="searchinput-inner">
                     <p>Retailer Name</p>
                     <select name="workername" id="workername" className="searchinput" onChange={(e) => { handleRetailerChange(e) }}>
                        <option value="">select retailer name</option>

                        {
                           showRetailers
                           ?
                           
                           allRetailers.map((retailer, key) => {
                              return (
                                 <option key={key} value={retailer.retailer_code}>{retailer.retailer_name.charAt(0).toUpperCase() + retailer.retailer_name.slice(1)}</option>
                                
                              )
                           }) :
                           (
                             <></>
                           )

                        }

                     </select>
                  </div>
               </div>
            </div>
            {
               isLoading
                  ?

                  <div className="top-heading-title">
                     ...Loading
                  </div>
                  :
                  <>
                     {ordersEmpty
                        ?
                        <>
                           <div className="top-heading-title">
                              No Orders for this Retailer .!
                           </div>
                        </>

                        :
                        <div className="order-table pixler">
                           <div>{retailer}</div>
                           <table className="table">
                              <thead>
                                 <tr>
                                    <th>Order #</th>
                                    <th>Order Date</th>
                                    <th> Customer Name </th>
                                    <th> Total Amount </th>
                                    <th> Invoice </th>
                                    <th> Select </th>
                                 </tr>
                              </thead>
                              <tbody>
                                 {
                                    orders.map((order, key) => {
                                       if (order.invoiceSent === false) {
                                          return (
                                             <tr key={key}>
                                                <td>{order.orderId}</td>
                                                <td>{order.orderDate}</td>
                                                <td>{order.customerName ? order.customerName.charAt(0).toUpperCase() + order.customerName.slice(1) : ""}</td>
                                                <td>{order.invoice.total_amount}</td>
                                                <td> <Button onClick={() => handleClickOpen(order._id)} className="Eyebtn"> <EditIcon /> </Button>  <Button onClick={() => exportPDF(order._id)} className="Eyebtn"> <RemoveRedEyeIcon /> </Button></td>
                                                <td> {order.invoice.total_amount && order.invoice.total_amount !== 0
                                                   ?
                                                   <input type="checkbox" data-order_id={order['_id']} onChange={(e) => handleCheckBox(e)} disabled={order.invoiceSent == true ? true : false} />
                                                   :
                                                   <span style={{ color: "red" }}>"Please create an invoice for this order !."</span>
                                                }
                                                </td>
                                             </tr>
                                          )
                                       }

                                    })
                                 }
                              </tbody>
                           </table>
                           <div className="invoice-form-NM bottomINput">
                              <form>
                                 <div className="from-group f" style={{ display: "flex", width: "100%", flexWrap: "wrap", alignItems: "end", margin: "0 -15px" }}>
                                    <div className="searchinput-inner">
                                       <p>Subtotal</p>
                                       <input disabled={true} type="text" className="searchinput" placeholder="00" value={subTotal} />
                                    </div>
                                    <div className="searchinput-inner">
                                       <p>Shipping Cost</p>
                                       <input type="text" onChange={(e) => handleShippingCostChange(e)} className="searchinput" placeholder="00" value={shippingCost} />
                                    </div>
                                    <div className="searchinput-inner">
                                       <p>Discount</p>
                                       <input type="text" onChange={(e) => handleDiscountChange(e)} className="searchinput" placeholder="00" value={discount} />
                                    </div>

                                    <div className="searchinput-inner">
                                       <p>Due Date</p>
                                       <input type="date" onChange={(e) => setDueDate(e.target.value)} value={dueDate} className="searchinput" />
                                    </div>
                                    <div className="searchinput-inner">
                                       <p>Total Amount</p>
                                       <input disabled={true} type="text" className="searchinput" value={balance} />
                                    </div>
                                    <div className="searchinput-inner">
                                       <Button className="custom-btn" onClick={(e) => handleRetailerInvoice(e)}> Submit  </Button>
                                    </div>

                                 </div>
                              </form>
                           </div>

                        </div>
                     }
                  </>
            }
         </div>
         <Dialog
            open={open2}
            onClose={handleClose2}
            aria-labelledby="alert-dialog-title"
            aria-describedby="alert-dialog-description"
            className="dialog-width"

         >
            <DialogContent>
               <div className="order-table manage-page" >
                  <div className="top-heading-title">
                     <strong> Invoice </strong>
                  </div>
                  <div>
                     <table >
                        <thead>
                           <tr>
                              <th colSpan={4}>PRODUCT</th>
                              <th></th>
                              <th >PRICE</th>
                           </tr>
                        </thead>
                        <tbody>
                           {
                              orderItems.length > 0
                                 ?
                                 orderItems.map((item, index) => {
                                    return (
                                       <>
                                          <tr key={index}>
                                             <td
                                                colSpan={4}
                                                style={{ color: "black", fontSize: "13px", fontWeight: 700 }}>
                                                {item['item_code'].toUpperCase()} in fabric from retailer
                                                <strong style={{ fontSize: "12px" }}>({item['fabric']})</strong>
                                             </td>

                                             <td></td>
                                             <td>
                                                <input name="price" type="number" style={{ width: "55px" }}
                                                   value={item["price"]}
                                                   min="0"
                                                   onChange={(event) =>
                                                      handleInputChange(event, index)}
                                                />
                                             </td>
                                             <td>
                                                <AddCircleIcon onClick={(e) => handleListAdd(index, item['item_name'])} />
                                             </td>

                                          </tr>
                                          {
                                             item['styles']
                                                ?
                                                Object.keys(item['styles']).map((styles, i) => {
                                                   return (
                                                      <tr key={i} style={{ backgroundColor: "#50c3e52b" }}>
                                                         <td colSpan={4} style={{ color: "black", fontSize: "13px", fontWeight: 700 }}>{styles.toUpperCase()} ({item['styles'][styles]['value']})</td>
                                                         <td></td>
                                                         <td>
                                                            <input
                                                               type="number"
                                                               name="price"
                                                               style={{ width: "55px" }}
                                                               data-item={item['item_code']}
                                                               data-style={styles}
                                                               data-stylevalue={item['styles'][styles]['value']}
                                                               value={item['styles'][styles]['price']}
                                                               onChange={(event) =>
                                                                  handleInputStyleChange(event, i)
                                                               }
                                                            /></td>
                                                      </tr>
                                                   )
                                                })
                                                :
                                                <></>
                                          }{
                                             item['additional_charges']
                                                ?
                                                item['additional_charges'].map((charges, parent) => {

                                                   return (
                                                      <tr key={parent}>
                                                         <td colSpan={4}>
                                                            <input
                                                               type="text"
                                                               name="name"
                                                               value={charges.name}
                                                               placeholder="option"
                                                               onChange={(e) => handleAdditionalCharges(e, index, parent)}
                                                            />
                                                         </td>
                                                         <td></td>
                                                         <td>
                                                            <input
                                                               type="number"
                                                               name="price"
                                                               min="0"
                                                               value={charges.price}
                                                               style={{ width: "55px" }}
                                                               onChange={(e) => handleAdditionalCharges(e, index, parent)}
                                                            />
                                                            <Button
                                                               className="delete-icon"
                                                               onClick={() => handleRemoveItem(index, parent)}
                                                            >
                                                               <DeleteIcon />
                                                            </Button>
                                                         </td>
                                                      </tr>
                                                   )

                                                })
                                                :
                                                <></>
                                          }

                                       </>)

                                 })
                                 :
                                 <></>
                           }
                           <tr>
                              <td className="undrLine"> </td>
                              <td className="undrLine"> </td>
                              <td className="undrLine"> </td>
                              <td className="undrLine"> </td>
                              <td className="undrLine"> </td>

                              <td className="undrLine"><strong className="pl_20">Total = {totalPrice}</strong></td>
                              {/* <td className="text-center undrLine"><strong className="pl_20">{totalPrice}</strong></td> */}
                           </tr>

                        </tbody>
                     </table>
                     <div className="image-note">
                        <textarea
                           style={{ border: "1px solid" }}
                           className="searchinput"
                           placeholder="note..."
                           value={note}
                           onChange={(e) => setNote(e.target.value)}
                        >
                        </textarea>
                     </div>
                  </div>
               </div>
            </DialogContent>
            <DialogActions>
               <Button
                  onClick={handleCreateInvoice}
                  className="custom-btn"
                  autoFocus
               >
                  Save
               </Button>
            </DialogActions>
         </Dialog>

         {success && (
                <Snackbar
                  open={open}
                  autoHideDuration={2000}
                  onClose={handleClose}
                >
                  <Alert
                    onClose={handleClose}
                    severity="success"
                    sx={{ width: "100%" }}
                  >
                   Invoice created successfully!
                  </Alert>
                </Snackbar>
              )}
              {error && (
                <Snackbar
                  open={open}
                  autoHideDuration={2000}
                  onClose={handleClose}
                  action={action}
                >
                  <Alert
                    onClose={handleClose}
                    severity="error"
                    sx={{ width: "100%" }}
                  >
                    {errorMsg}
                  </Alert>
                </Snackbar>
              )}
      </main>
   )
}
