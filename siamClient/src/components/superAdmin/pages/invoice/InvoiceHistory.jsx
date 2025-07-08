import React from "react";
import "./invoice.css";
import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@mui/material";
import RemoveRedEyeIcon from "@mui/icons-material/RemoveRedEye";
import SendIcon from "@mui/icons-material/Send";
import { Context } from "../../../../context/Context";
import { useEffect } from "react";
import { useContext } from "react";
import { axiosInstance } from "../../../../config";
import Pagination from '@mui/material/Pagination';
import Stack from '@mui/material/Stack';
import { renderToString } from "react-dom/server";
import jsPDF from 'jspdf';
import Logo from '../../../../images/logo.png';
import FilterAltIcon from '@mui/icons-material/FilterAlt';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import Snackbar from "@mui/material/Snackbar";
import MuiAlert from "@mui/material/Alert";
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';

export default function InvoiceHistory() {
  const [data, setData] = useState();
  const [allRetailers, setAllRetailers] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [invoice, setInvoice] = useState([]);
  const [thisInvoice, setThisInvoice] = useState({})
  const { user } = useContext(Context);
  const [isLoading, setIsLoading] = useState(true);
  const [ordersEmpty, setOrdersEmpty] = useState(false);
  const [retailer, setRetailer] = useState({});
  const [retailer_code, setRetailer_code] = useState("");

  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [page, setPage] = useState(1);
  const [docLength, setDoc] = useState(Number);
  const [limit, setLimit] = useState(10);
  const [index, setIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("")
  const [error, setError] = useState(false)
  const [successMsg, setSuccessMsg] = useState("")
  const [success, setSuccess] = useState(false)
  const [open, setOpen] = useState(false)
  const [openOrderInvoiceTable, setOpenOrderInvoiceTable] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const [showRetailers, setShowRetailers] = useState(false)


  const Alert = React.forwardRef(function Alert(props, ref) {
    return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
  });



  const count = Math.ceil(docLength / limit);

  const handleChangePage = (e, p) => {
    setIndex(limit * (p - 1))
    setPage(p)
    fetchInvoices(p, limit, retailer_code)
  }



  useEffect(() => {
    const fetchRetailers = async () => {
      const res = await axiosInstance.post("/retailer/fetchAll", {
        token: user.data.token,
      });   
      if(res.data.status === true){
        setShowRetailers(true)
        setAllRetailers(res.data.data)
    }
    };
    fetchRetailers();
  }, []);

  const handleRetailerChange = async (e) => {
    const currentRetailer = allRetailers.filter((retailer) => {
      return retailer.retailer_code == e.target.value;
    });
    setRetailer(currentRetailer[0]);
    setRetailer_code(e.target.value);
    if (e.target.value == " ") {
      setInvoice([]);
    } else {
      fetchInvoices(page, limit, e.target.value);
    }
    setIsLoading(false);
  };

  console.log("dfsjdnfd: ", retailer)

  const handleCloseOrderInvoiceTable = () => {
    setOpenOrderInvoiceTable(false)
  }
  const handleViewInvoiceModal =(invoiceID) =>{
    const thisInvoiceArray = invoices.filter(inv => inv._id == invoiceID)
    setThisInvoice(thisInvoiceArray[0])
    setShowInvoice(true)
    setOpenOrderInvoiceTable(true)
  }

  // static function=======================================

  const fetchInvoices = async (page, limit, code) => {
    const res = await axiosInstance.post(`/retailerInvoice/fetchPaginate/?page=${page}&limit=${limit}&retailer_code=${code}`, {
      token: user.data.token,
    });
    

    if (res.data.data.length > 0) {
      setDoc(res.data.meta.totalDocs)
      setInvoices(res.data.data)
      setOrdersEmpty(false);
    } else {
      setOrdersEmpty(true);
    }
  };
  const fetchRetailerOrders = async (sd, ed, rc) => {
    const data = {
      start_date: sd,
      end_date: ed,
    };
    // const res = await axiosInstance.post(
    //   "/customerOrders/fetchFiltered/" + rc,
    //   { token: user.data.token, retailer: data }
    // );
    // if (res.data.data.length > 0) {
    //   setOrders(res.data.data);
    //   setOrdersEmpty(false);
    // } else {
    //   setOrdersEmpty(true);
    // }
  };

  
  // static function=======================================



  const handleFilterInovice = async () => {

    if (startDate == "") {
      setOpen(true)
      setError(true)
      setErrorMsg("Start Date is invalid!")
    } else if (endDate == "") {
      setOpen(true)
      setError(true)
      setErrorMsg("End Date is invalid!")
    } else {
      console.log(startDate, endDate)
      const filterData = invoices.filter((invoice) => {
        return new Date(invoice.dueDate).getTime() >= new Date(startDate).getTime() && new Date(invoice.dueDate).getTime() <= new Date(endDate).getTime()
      })
      setInvoices(filterData)
    }

  };
  const handleResetAll = () => {
    fetchInvoices(page, limit, retailer_code);
    setStartDate("")
    setEndDate("")
  }
  
  const exportPDF = async (id) => {
    const res = await axiosInstance.post("/retailerInvoice/fetch/" + id, { token: user.data.token })
    let orders = res.data.data[0].orders


    let currentInvoice = invoices.filter((inv) => {
      return id == inv._id
    })

    let htmlElement = (
      <>
        <div style={{ textAlign: 'center', margin: '25px', fontFamily: "Roboto" }}>
          <table style={{ width: '725px' }} cellSpacing={0} cellPadding={2} border={0}>
            <tbody>
              <tr>
                <td colSpan={3} align="left" style={{ borderBottom: '1px solid #ccc' }} valign="middle">
                  <img src={Logo} alt="logo" height="60px" />
                </td>
                <td colSpan={2} align="right" style={{ borderBottom: '1px solid #ccc' }}>
                  <p style={{ lineHeight: '15px', color: '#666', textAlign: 'right' }}>
                    <font style={{ fontSize: '10px', textAlign: 'right' }}>1022/87 Charoen Nakorn 34/2<br />Banglampu-Lang, Bangkok<br />10600 Thailand.</font>
                  </p>
                </td>
              </tr>
              <tr style={{ backgroundColor: "white" }}>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  <font style={{ fontSize: '15px', color: '#26377D', fontWeight: 'bold' }}>{"Invoice: " + currentInvoice[0]['invoice_number']}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: "white" }}>
                <td colSpan={3} style={{ textAlign: 'left' }}>
                  <div style={{display: "flex", flexDirection:"column"}}>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Sold To :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{orders[0]['retailerName']}</span></font>
                  </div>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Retailer Address :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{retailer['address'] ? retailer['address'] : "N/A"}</span></font>
                  </div>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Retailer Email :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{retailer['email'] ? retailer['email'] : "N/A"}</span></font>
                  </div>
                  </div>
                </td>
                <td colSpan={2} style={{ textAlign: 'right' }}>
                  <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Date :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{res.data.data[0].dueDate}</span></font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#26377D', padding: '10px 20px' }}>
                <th colSpan={1} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>ORDER NO</strong></font>
                </th>
                <th colSpan={1} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>CUSTOMER</strong></font>
                </th>
                <th colSpan={2} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>PRODUCTS</strong></font>
                </th>
                <th colSpan={1} style={{ textAlign: 'right', color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>AMOUNT</strong></font>
                </th>
              </tr>
              {orders.map((order, i) => {
                return (
                  <>
                    <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>{order.orderId}</font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px', textTransform:"capitalize" }}>{order.customerName}</font>
                      </td>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>
                          {order.order_items.map((product, i) => (i > 0 ? `+ ${product.quantity} ${product.item_name.charAt(0).toUpperCase() +
                            product.item_name.slice(1)}` : `${product.quantity} ${product.item_name.charAt(0).toUpperCase() +
                            product.item_name.slice(1)}`))}
                        </font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                        <font style={{ fontSize: '14px' }}>{order.invoice.total_amount}</font>
                      </td>
                    </tr>
                    {/* <tr colSpan={0.5} style={{fontSize: "5px", border:"solid 1px #d4d4d4"}}>
                    <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}} >Item</td>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}}>Fabric</td>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}}>Cost</td>
                        </tr>
                    {order['invoice']['items'].map((item) => {
                      return(
                       <tr key={item['_id']} style={{ backgroundColor: '#f4f4f4' }}>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['item_code']}</td>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['fabric']}</td>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['price']}</td>
                        
                       </tr>
                      )
                    })}
                    </tr> */}
                  </>
                )
              })}
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Subtotal</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{res.data.data[0].total_price}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Shipping Cost</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{res.data.data[0].shipping_charge}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Discount</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].discount}</font>
                </td>
              </tr>
              {/* <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Balance</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>10400.00</font>
                </td>
              </tr> */}
              <tr style={{ backgroundColor: '#D3D3D3' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Total Amount</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].total_amount}</font>
                </td>
              </tr>
              {/* <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Due Date</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].dueDate}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Balance due on 02/Aug/2018</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>0.00</font>
                </td>
              </tr> */}
              <tr style={{ backgroundColor: 'white' }}>
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
      callback: async function (doc) {
        // const pdfBlob = doc.output("blob"); // Blob format
        // const pdfBase64 = doc.output("datauristring"); // Base64 format
    
        // // Create form data to send the Blob or base64 to backend
        // const formData = new FormData();
        // formData.append("file", new File([pdfBlob], "invoice.pdf", { type: "application/pdf" }));
    
        // try {
        //   await fetch("http://localhost:4545/retailerInvoice/send-email", {
        //     method: "POST",
        //     body: formData,
        // });
        //     alert("Email Sent Successfully!");
        // } catch (error) {
        //     console.error("Error sending email:", error);
        // }
        window.open(doc.output('bloburl'), '_blank');
      },
      x: 10,
      y: 10,
    });
        // Generate PDF as Blob or base64 (choose one method)
        // const pdfBlob = doc.output("blob"); // Blob format
        // const pdfBase64 = doc.output("datauristring"); // Base64 format
    
        // // Create form data to send the Blob or base64 to backend
        // const formData = new FormData();
        // formData.append("file", new File([pdfBlob], "invoice.pdf", { type: "application/pdf" }));
    
        // try {
        //   await fetch("http://localhost:4545/retailerInvoice/send-email", {
        //     method: "POST",
        //     body: formData,
        // });
        //     alert("Email Sent Successfully!");
        // } catch (error) {
        //     console.error("Error sending email:", error);
        // }
  }

  const handleSendMail = async (id) => {
    const res = await axiosInstance.post("/retailerInvoice/fetch/" + id, { token: user.data.token })
    let orders = res.data.data[0].orders
    let currentInvoice = invoices.filter((inv) => {
      return id == inv._id
    })

    let htmlElement = (
      <>
        <div style={{ textAlign: 'center', margin: '25px', fontFamily: "Roboto" }}>
          <table style={{ width: '725px' }} cellSpacing={0} cellPadding={2} border={0}>
            <tbody>
              <tr>
                <td colSpan={3} align="left" style={{ borderBottom: '1px solid #ccc' }} valign="middle">
                  <img src={Logo} alt="logo" height="60px" />
                </td>
                <td colSpan={2} align="right" style={{ borderBottom: '1px solid #ccc' }}>
                  <p style={{ lineHeight: '15px', color: '#666', textAlign: 'right' }}>
                    <font style={{ fontSize: '10px', textAlign: 'right' }}>1022/87 Charoen Nakorn 34/2<br />Banglampu-Lang, Bangkok<br />10600 Thailand.</font>
                  </p>
                </td>
              </tr>
              <tr style={{ backgroundColor: "white" }}>
                <td colSpan={5} style={{ textAlign: 'center' }}>
                  <font style={{ fontSize: '15px', color: '#26377D', fontWeight: 'bold' }}>{"Invoice: " + currentInvoice[0]['invoice_number']}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: "white" }}>
                <td colSpan={3} style={{ textAlign: 'left' }}>
                  <div style={{display: "flex", flexDirection:"column"}}>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Sold To :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{orders[0]['retailerName']}</span></font>
                  </div>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Retailer Address :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{retailer['address'] ? retailer['address'] : "N/A"}</span></font>
                  </div>
                  <div style={{display: "flex", flexDirection:"row", marginBottom:"10px"}}><font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Retailer Email :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{retailer['email'] ? retailer['email'] : "N/A"}</span></font>
                  </div>
                  </div>
                </td>
                <td colSpan={2} style={{ textAlign: 'right' }}>
                  <font style={{ fontSize: '12px', color: '#333', fontWeight: 700 }}>Date :</font>
                  <font style={{ fontSize: '12px', color: '#333' }}><span style={{ paddingLeft: "10px" }}>{res.data.data[0].dueDate}</span></font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#26377D', padding: '10px 20px' }}>
                <th colSpan={1} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>ORDER NO</strong></font>
                </th>
                <th colSpan={1} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>CUSTOMER</strong></font>
                </th>
                <th colSpan={2} style={{ color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>PRODUCTS</strong></font>
                </th>
                <th colSpan={1} style={{ textAlign: 'right', color: '#fff', lineHeight: '15px' }}>
                  <font style={{ fontSize: '12px' }}><strong>AMOUNT</strong></font>
                </th>
              </tr>
              {orders.map((order, i) => {
                return (
                  <>
                    <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>{order.orderId}</font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px', textTransform:"capitalize" }}>{order.customerName}</font>
                      </td>
                      <td colSpan={2} style={{ color: '#444', borderBottom: '1px solid #d4d4d4' }}>
                        <font style={{ fontSize: '14px' }}>
                          {order.order_items.map((product, i) => (i > 0 ? `+ ${product.quantity} ${product.item_name.charAt(0).toUpperCase() +
                            product.item_name.slice(1)}` : `${product.quantity} ${product.item_name.charAt(0).toUpperCase() +
                            product.item_name.slice(1)}`))}
                        </font>
                      </td>
                      <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                        <font style={{ fontSize: '14px' }}>{order.invoice.total_amount}</font>
                      </td>
                    </tr>
                    {/* <tr colSpan={0.5} style={{fontSize: "5px", border:"solid 1px #d4d4d4"}}>
                    <tr key={i} style={{ backgroundColor: '#f4f4f4' }}>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}} >Item</td>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}}>Fabric</td>
                          <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4', fontSize:"12px"}}>Cost</td>
                        </tr>
                    {order['invoice']['items'].map((item) => {
                      return(
                       <tr key={item['_id']} style={{ backgroundColor: '#f4f4f4' }}>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['item_code']}</td>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['fabric']}</td>
                        <td style={{ color: '#444', borderBottom: '1px solid #d4d4d4',fontSize: "10px" }} >{item['price']}</td>
                        
                       </tr>
                      )
                    })}
                    </tr> */}
                  </>
                )
              })}
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Subtotal</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{res.data.data[0].total_price}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>Shipping Cost</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', fontWeight: 'bold' }}>{res.data.data[0].shipping_charge}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Discount</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].discount}</font>
                </td>
              </tr>
              {/* <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Balance</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>10400.00</font>
                </td>
              </tr> */}
              <tr style={{ backgroundColor: '#D3D3D3' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Total Amount</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].total_amount}</font>
                </td>
              </tr>
              {/* <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Due Date</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>{res.data.data[0].dueDate}</font>
                </td>
              </tr>
              <tr style={{ backgroundColor: '#f4f4f4' }}>
                <td colSpan={4} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>Balance due on 02/Aug/2018</font>
                </td>
                <td colSpan={1} style={{ color: '#444', borderBottom: '1px solid #d4d4d4', textAlign: 'right' }}>
                  <font style={{ fontSize: '15px', textAlign: 'right', fontWeight: 'bold' }}>0.00</font>
                </td>
              </tr> */}
              <tr style={{ backgroundColor: 'white' }}>
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
      callback: async function (doc) {
        const pdfBlob = doc.output("blob"); // Blob format
        const pdfBase64 = doc.output("datauristring"); // Base64 format
    
        // Create form data to send the Blob or base64 to backend
        const formData = new FormData();
        formData.append("file", new File([pdfBlob], "invoice.pdf", { type: "application/pdf" }));
        formData.append("email", retailer['email']); // Add email to the form data
    
        try {
        const response = await axiosInstance.post("/retailerInvoice/send-email", formData, {
          headers: {
              "Content-Type": "multipart/form-data",
          },
      });
            // alert("Email Sent Successfully!");
            setSuccess(true)
            setSuccessMsg("Email Sent Successfully!")
            setError(false)
        } catch (error) {
            console.error("Error sending email:", error);
        }
      },
      x: 10,
      y: 10,
    });
        // Generate PDF as Blob or base64 (choose one method)
        // const pdfBlob = doc.output("blob"); // Blob format
        // const pdfBase64 = doc.output("datauristring"); // Base64 format
    
        // // Create form data to send the Blob or base64 to backend
        // const formData = new FormData();
        // formData.append("file", new File([pdfBlob], "invoice.pdf", { type: "application/pdf" }));
    
        // try {
        //   await fetch("http://localhost:4545/retailerInvoice/send-email", {
        //     method: "POST",
        //     body: formData,
        // });
        //     alert("Email Sent Successfully!");
        // } catch (error) {
        //     console.error("Error sending email:", error);
        // }
  }

  const exportSingleInvoicePDF = async (id) => {
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

  const handleClose = (event, reason) => {
    if (reason === "clickaway") {
      return;
    }
    setOpen(false)
    setError(false)
    setSuccess(false)
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
            <strong> Invoice History </strong>
          </div>
          <div className="manage-filter-position">
            <div className="searchstyle searchstyle-one">
              <div className="searchinput-inner">
                <p>Start Date</p>
                <input
                  type="date"
                  value={startDate}
                  className="searchinput"
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="searchinput-inner">
                <p>End Date</p>
                <input
                  type="date"
                  value={endDate}
                  className="searchinput"
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
              <Button className="Eyebtn" onClick={handleFilterInovice}><FilterAltIcon /></Button>
              <Button className="Eyebtn" onClick={handleResetAll} style={{ marginLeft: '10px' }}><RestartAltIcon /></Button>
            </div>
            <div className="searchstyle searchstyle-one">
              <div className="searchinput-inner">
                <p>Retailer Name</p>
                <select
                  name="workername"
                  id="workername"
                  className="searchinput"
                  onChange={(e) => {
                    handleRetailerChange(e);
                  }}
                >
                  <option value="">select retailer name</option>

                  {
                  showRetailers
                  ?
                  allRetailers.map((retailer, key) => {
                    return (
                      <option key={key} value={retailer.retailer_code}>
                        {retailer.retailer_name}
                      </option>
                    );
                  })
                :
                (
                  <></>
                )}
                </select>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="top-heading-title">...Loading</div>
        ) : (
          <>
            {ordersEmpty ? (
              <>
                <div className="top-heading-title">
                  No Invoice for this Retailer .!
                </div>
              </>
            ) : (
              <>
                <div className="order-table">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Invoice Summary</th>
                        <th>Balance</th>
                        <th>Due Date</th>
                        <th>View</th>
                        <th>Resend</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoices.map((invoice, i) => (
                        <tr key={i}>
                          <td style={{ width: "350px" }}>
                            <span style={{ display: "block" }}>
                              {/* {invoice.orders.map((order, i) => (i > 0 ? `, ${order.orderId}` : order.orderId))} */}
                              {invoice['invoice_number']}
                            </span>
                          </td>
                          <td>{invoice.total_price}</td>
                          <td>{invoice.dueDate}</td>
                          <td><Button onClick={() => handleViewInvoiceModal(invoice['_id'])} className="Eyebtn"><RemoveRedEyeIcon /></Button></td>
                          {/* exportPDF(invoice._id) */}
                          <td><Button className="Eyebtn"onClick={() => handleSendMail(invoice['_id'])}><SendIcon /></Button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {/* {page > 1 &&  */}
                  <Stack spacing={2}>
                    <Pagination count={count} page={page} color="primary" onChange={handleChangePage} />
                  </Stack>
                  {/* } */}
                </div>
              </>
            )}
          </>
        )}
      </div>
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
   {success && (
        <Snackbar
          open={success}
          autoHideDuration={2000}
          onClose={handleClose}
          action={action}
        >
          <Alert
            onClose={handleClose}
            severity="success"
            sx={{ width: "100%" }}
          >
            {successMsg}
          </Alert>
        </Snackbar>
      )}

        {/* dialogues ==================== */}
    <div>
      <Dialog
        open={openOrderInvoiceTable}
        onClose={handleCloseOrderInvoiceTable}
        aria-labelledby="alert-dialog-title"
        aria-describedby="alert-dialog-description"
      >
        <DialogTitle id="alert-dialog-title">
        </DialogTitle>
        <DialogContent>
          <div style={{display: "flex", flexDirection: "row", justifyContent:"end"}}>
            {/* <div>
              <div>Group Name: <span>{order[0] !== undefined ? order[0]['name'].toUpperCase() : ""}</span></div>
              <div>Retailer: <span>{order[0] !== undefined ? order[0]['retailerName'].toUpperCase() : ""}</span></div>
            </div> */}

              {
                showInvoice
                ?
                  <div className="view-all-pdf"><span onClick={(e) => exportPDF(thisInvoice['_id'])}>View Invoice Summary</span></div>
                :
                <></>
              }

            </div>
          <div style={{}}>
            <table>
              <thead>
                    <th><strong>S No. </strong></th>
                    <th><strong>Order No. </strong></th>
                    <th><strong>View</strong></th>
              </thead>
              <tbody>
                    {showInvoice
                    ?
                    thisInvoice['orders'].map((order, index) => {
                      return(
                        <tr key={order['_id']}>
                          <td>{index + 1}</td>
                          <td><span style={{textTransform: "capitalize"}}>{order['orderId']}</span></td>
                          <td className="view-single-pdf-td"> <span onClick={() => exportSingleInvoicePDF(order['_id'])} data-orderId = {order['_id']} style={{color: "#1C4D8F", fontWeight: "600"}}>View</span></td>
                        </tr>
                      )
                    })
                    :
                    <></>}
              </tbody>
            </table>
          </div>
        </DialogContent>
      </Dialog>
    </div>
    </main>
  );
}
