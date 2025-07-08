import React from 'react'
import './productList.css'
import { Button } from "@mui/material";
import { Link } from 'react-router-dom';
import DeleteIcon from '@mui/icons-material/Delete';

export default function Step3({ customer }) {
  // console.log(customer)
  return (
    // <main className="main-panel">
      // <div className="content-wrapper pd-1r">
      <div className="order-table manage-page">  
        <div className="productbox">
          <div className="step4BOXED">
            <h3 className="product-title-head"> Product Information </h3>
            <p className="product-title-name-short"> <strong> {`${customer.firstname} ${customer.lastname}`}</strong> </p>
          </div>
          <div className="boxedTWo">
            <button type="button" className="custom-btn"><i className="fa-solid fa-plus"></i> Add New Item </button>
          </div>
        </div>
      <table className="table">
          <thead>
            <tr>
              <th>PRODUCT</th>
              <th>Measurement</th>
              <th>fabric & styling</th>
              <th>Delete</th>
            </tr>
          </thead>
          <tbody>
              <tr>
              <td><strong>Longtail</strong></td>
              <td>Missing</td>
              <td><Link to="/retailer/missingfabric">Missing Fabric / Styling</Link></td>
              <td><Button className="minusIc"> <DeleteIcon/> </Button></td>
              </tr>
              <tr>
              <td><strong>Jacket</strong></td>
              <td>Missing</td>
              <td><Link to="/retailer/missingfabric">Missing Fabric / Styling</Link></td>
              <td><Button className="minusIc"> <DeleteIcon/> </Button></td>
              </tr>
              <tr>
              <td><strong>Longtail</strong></td>
              <td>Missing</td>
              <td><Link to="/retailer/missingfabric">Missing Fabric / Styling</Link></td>
              <td><Button className="minusIc"> <DeleteIcon/> </Button></td>
              </tr>
              <tr>
              <td><strong>Jacket</strong></td>
              <td>Missing</td>
              <td><Link to="/retailer/missingfabric">Missing Fabric / Styling</Link></td>
              <td><Button className="minusIc"> <DeleteIcon/> </Button></td>
              </tr>
              <tr>
              <td><strong>Longtail</strong></td>
              <td>Missing</td>
              <td><Link to="/retailer/missingfabric">Missing Fabric / Styling</Link></td>
              <td><Button className="minusIc"> <DeleteIcon/> </Button></td>
              </tr>
          </tbody>
          </table>
          </div>
        // </div>
    // </main>
  )
}
