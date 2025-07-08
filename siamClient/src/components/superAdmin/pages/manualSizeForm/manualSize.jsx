import React from "react";
import { useState, useContext, useEffect } from "react";
import { Link } from "react-router-dom";

export default function jacket(){
    const { user } = useContext(Context);
    const [inputValue, setInput] = useState({
        input1:"",
        input2:"",
        input3:"",
        input4:"",
        chiffon:false,
        nangkai: false
    });
    const [loading, setLoading] = useState(true);

    

}