import { Button } from "@mui/material";
import DeleteIcon from "@mui/icons-material/Delete";
import CancelIcon from "@mui/icons-material/Cancel";
import CheckCircleIcon from "@mui/icons-material/CheckCircle";

export default function Customers({
  groupOrderCustomers, setGroupOrderCustomers, 
  customerArray, setCustomerArray, 
  setshowCustomerAddButton,
  handleManageCustomer
}){

  const completeMeasurementStyles = {
    color: "green",
    cursor: "pointer",
    fontWeight: 600
  }

  const handleRemoveCustomer = (e, did) => {
    const newCustomerArray = customerArray.filter((x) => x != did)
    setCustomerArray(newCustomerArray)
    const newGroupOrderCustomer = groupOrderCustomers.filter((cus) => cus._id != did)
    setGroupOrderCustomers(newGroupOrderCustomer)
    setshowCustomerAddButton(true)
  }

  const handleCustomer = (e, cid) => { 
    // console.log(cid)
    handleManageCustomer(cid)
  }

  // console.log(customerArray)


  return (
    <div>
      {
        groupOrderCustomers.length > 0
        ?
        <table className="table">
                  <thead>
                    <tr>
                      <th> S.NO.</th>
                      <th> Customer Name </th>
                      <th> Manage Customer </th>
                      <th> Form Status </th>
                    </tr>

                    {
                      groupOrderCustomers.map((data, index) => {
                        return (
                          <tr key={index}>
                            <td>{index + 1}</td>
                            <td>
                              <span>{data.firstname ? data.fullname : "--"}</span>
                            </td>
                            <td>
                              <span
                                onClick={(event) =>
                                  handleCustomer(event, data._id, index)
                                }
                              >
                                {data.firstname ? (
                                  <span style={completeMeasurementStyles}>Manage</span>
                                ) : (
                                  <span style={{ color: "red" }}>Missing</span>
                                )}
                              </span>
                            </td>
                            <td>
                              {data.firstname ? (
                                <CheckCircleIcon color="success" />
                              ) : (
                                <CancelIcon color="error" />
                              )}
                            </td>
                            <td colSpan="2">
                              <Button
                                className="delete-icon"
                                onClick={(event) =>
                                  handleRemoveCustomer(event, data._id)
                                }
                              >
                                {" "}
                                <DeleteIcon />{" "}
                              </Button>{" "}
                            </td>
                          </tr>
                        );
                      })}
                  </thead>
        </table>
        :
        <div>
          <h3>
            No Customers in table !
          </h3>
        </div>              

      }
    </div>
  )
}