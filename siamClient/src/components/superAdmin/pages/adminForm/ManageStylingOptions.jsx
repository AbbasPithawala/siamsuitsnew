import React, { useState, useContext, useEffect } from "react";
import { Context } from "../../../../context/Context";
import { axiosInstance } from "./../../../../config";
import { useLocation } from "react-router-dom";
import IconButton from "@mui/material/IconButton";
import CloseIcon from "@mui/icons-material/Close";
import MuiAlert from "@mui/material/Alert";
import DeleteIcon from "@mui/icons-material/Delete";
import Button from "@mui/material/Button";
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { PicBaseUrl } from "./../../../../imageBaseURL";
import ImageUpload from "../../../../images/ImageUpload.png";
import "./ManageStylingOptions.css";

const Alert = React.forwardRef(function Alert(props, ref) {
  return <MuiAlert elevation={6} ref={ref} variant="filled" {...props} />;
});

export default function ManageEditStyling(props) {
  const { user } = useContext(Context);
  const [currentStyle, setCurrentStyle] = useState({});
  const [styleOptions, setStyleOptions] = useState([]);
  const [option, setOption] = useState({});
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [newOption, setNewOption]  = useState({});
  const [imageData, setImageData] = useState(null)
  const [imageFound, setImageFound] = useState(false)

  useEffect(() => {
    fetchStyle(props.styleId)
  }, [props.styleId])

  const handleClickOpenEditDialog = (e, optionsID) => {
    console.log("_id", e.target.dataset.name)
    for(let x of styleOptions){
      console.log("x: ", x)
      if(x._id == optionsID){
        console.log(x)
        setOption(x)
      }
    }
    // setTimeout(() =>{
      setOpenEditDialog(true);
    // }, 1000)
    
  };

// console.log(option)
  const handleCloseEditDialog = () => {
    setOpenEditDialog(false);
  };

  const handleClickOpenAddDialog = (e) => {
    setOpenAddDialog(true);
  };

  const handleCloseAddDialog = () => {
    setOpenAddDialog(false);
  };

  const handleValueChange = (e) => {
    option[e.target.name] = e.target.value
    setOption({...option})
  }

  const handleNewValueChange = (e) => {
    console.log(e.target.name, e.target.value)
    newOption[e.target.name] = e.target.value
    setNewOption({...newOption})
  }

  const handleEditOption = async (e) => {

    const optionData = option

    if(imageData){
      const data = new FormData();
      data.append("image", imageData);
      const result = await axiosInstance.post("image/OptionUpload", data);
  
      optionData['image'] = result.data.data
    }

 console.log("options data: ", optionData)

    const res = await axiosInstance.put("/style/updateSingleOption/" + props.styleId, {option: optionData, token: user.data.token})
    console.log(res.data.data)
    if(res.data.status == true){
      setOpenEditDialog(false)
      setStyleOptions(res.data.data['style_options'])
      setImageData(null)
    }
  }

  const handleAddOption = async() => {
    const optionData = {}
    if(imageData){
      const data = new FormData();
      data.append("image", imageData);
      const result = await axiosInstance.post("image/OptionUpload", data);
      
        optionData['name'] = newOption['name'];
        optionData['thai_name'] = newOption['thaiName'];
        optionData['image'] = result.data.data
      
    }else{
        optionData['name'] = newOption['name']
        optionData['thai_name'] = newOption['thaiName'];
    }
  
    const res = await axiosInstance.put("/style/addSingleOption/" + props.styleId, {option: optionData, token: user.data.token})

    if(res.data.status == true){
      styleOptions.push(optionData)
      setNewOption({})
      setOpenAddDialog(false)
      setImageData(null)
    }

  }

  const handleDeleteOption = async (e) => {
    const styleOptionsArray = styleOptions
    const updatedArray = styleOptionsArray.filter((option) => {
      return option._id != e.target.dataset.name
    })
    // const res = await axiosInstance.put("/style/updateOptions/" + props.styleId, {styleOptions: updatedArray, token: user.data.token})
    // console.log(res.data.data)
    // if(res.data.status == true){
    //   setStyleOptions(updatedArray)
    // }
  }

  const handleAddImage = async(e) => {

    setImageData(e.target.files[0])
  }
   


  // ===================static function ======================
  // ===================static function ======================

    const fetchStyle = async(id) => {

      const res = await axiosInstance.post("/style/fetch/" + id, {token : user.data.token})
      console.log(res.data.data[0]['style_options'])
      setCurrentStyle(res.data.data[0])
      setStyleOptions(res.data.data[0]['style_options'])
      if(res.data.data[0]['image'].length > 0){
        setImageFound(true)
      }
    
    }

  // ===================static function ends ======================
  // ===================static function ends ======================


return (
    styleOptions ?
    <main className="main-panel">
    <div className="content-wrapper">
      <div className="order-table manage-page">
        <div className="top-heading-title">
          <strong> Edit Styling </strong>
        </div>
        <div className="factory-user-from-NM pd-15">
          <div className="modal-box-NM">
            <div className="d-flex form-group">
              <div><Button onClick={handleClickOpenAddDialog} className="custom-btn">Add Options</Button></div>
            
            </div>
            <div className="modal-inner-content">
              <table>
                <thead>
                  <tr>
                    <th> Name </th>
                    <th> Image </th>
                    <th> Action </th>
                  </tr>
                </thead>
                <tbody>
                  {
                    styleOptions
                    ?
                    styleOptions.map((options, index) => {
                      console.log("options: ", options)
                      return (
                        <tr key={options._id}>
                          <td>{options.name}</td>
                          <td>
                            <img 
                            height = "50" 
                            width = "50" 
                            src={
                              imageFound
                              ?
                              PicBaseUrl + currentStyle['image']
                              :
                              options.image 
                              ? 
                              PicBaseUrl + options.image
                              : 
                              ImageUpload
                            } 
                              alt="No image available" 
                              />
                          </td>
                          <td>
                            <Button
                            data-name={options._id}
                            onClick = {(e) => handleClickOpenEditDialog(e, options._id)}
                            >
                              <b>Edit</b>
                            </Button>

                            |
                            
                            <Button
                            data-name={options._id}
                            onClick = {(e) => handleDeleteOption(e)}
                            >
                              <b>Delete</b>
                            </Button>
                          </td>
                        </tr>
                      )
                    })
                    : <></>
                  }
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
    
    {/* Edit Option dialogue box */}
          {/* Edit Option dialogue box */}
               {/* Edit Option dialogue box */}

   <div className = "add-option-dialog">
   <Dialog
      open={openEditDialog}
      onClose={handleCloseEditDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      className = "add-option-dialog"
      // className = ""
      
    > 
        <DialogTitle id="alert-dialog-title">
        Edit Style Option
      </DialogTitle>
      {
        Object.keys(option).length > 0
        ?
        <DialogContent>
        <div className="addOptionInput">
          <label for="">Option Name</label>
          </div>
          <div>
          <input type="text" value={option.name} name="name" onChange = {(e) => handleValueChange(e)}/>
          </div>
          
          <div>
          <input type="text" value={option.thai_name} name="thai_name" onChange = {(e) => handleValueChange(e)}/>
          </div>
         
 
        <div>
        <label htmlFor={`inputfile-${option._id}`}>
                            {
                              <img
                                src={imageFound ? PicBaseUrl + currentStyle['image'] : option.image ? PicBaseUrl + option.image : ImageUpload }
                                width={60}
                                height={60}
                              />
                            }
                          </label>
                          <input
                            type="file"
                            name="image"
                            className="inputfile-button"
                            id={`inputfile-${option._id}`}
                            style={{ display: "" }}
                            onChange = {(e) => handleAddImage(e)}
                            disabled = {imageFound ? true : false}
                          />

                          
        </div>
                      <div>
                        <Button
                          onClick = {(e) => handleEditOption(e)}
                          className="custom-btn">
                            Edit Option
                        </Button>
                      </div>
      </DialogContent>
      :
      <>Loading...</>
      }
   
    </Dialog>
   </div>


    {/* Add Option dialogue box */}
          {/* Add Option dialogue box */}
                {/* Add Option dialogue box */}
<div  className = "add-option-dialog">

<Dialog
      open={openAddDialog}
      onClose={handleCloseAddDialog}
      aria-labelledby="alert-dialog-title"
      aria-describedby="alert-dialog-description"
      className = "add-option-dialog"
    > 
        <DialogTitle id="alert-dialog-title">
        Add Style Option
      </DialogTitle>
      <DialogContent>
        <div className="addOptionInput">
          <label for="">Option Name</label>
          <input type="text" value={newOption.name} name="name" onChange = {(e) => handleNewValueChange(e)}/>
          </div>
         

        <div className="addOptionInput">
          <label for="">Thai option Name</label>
          <input type="text" value={newOption.thaiName} name="thaiName" onChange = {(e) => handleNewValueChange(e)}/>
          </div>
          
        <div>
        <label htmlFor={`inputfile-${option._id}`}>
                            {
                              <img
                                src={ imageFound ? PicBaseUrl + currentStyle['image'] : ImageUpload }
                                width={60}
                                height={60}
                              />
                            }
                          </label>
                          <input
                            type="file"
                            name="image"
                            className="inputfile-button form-group"
                            id={`inputfile-${option._id}`}
                            style={{ display: "none" }}
                            onChange = {(e) => handleAddImage(e)}
                            disabled = {imageFound ? true : false}
                          />

                          
        </div>
                      <div className = "btn-submit-popup">
                        <Button
                          onClick = {(e) => handleAddOption(e)}
                          className="custom-btn">
                            Add Option
                        </Button>
                      </div>
      </DialogContent>
   
    </Dialog>
</div>
   

  </main>
:
<>Loading</>
  
);
  
}
