import React, { createContext, useReducer } from 'react';
import { initialValues } from './initialValues';
const isText = RegExp(/^[A-Z ]+$/i);
const isEmail = RegExp(/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i);
const isPhone = RegExp(/^\D?(\d{3})\D?\D?(\d{3})\D?(\d{4,6})$/); // us
const isZip = RegExp(/^[0-9]{5}([- /]?[0-9]{4})?$/); // us
const isNumber = RegExp(/^\d+$/);
// Applied to all fields
const variant = 'standard';
const margin = 'normal';
export const AppContext = createContext({
    activeStep: 0,
    formValues: initialValues,
    handleChange() { },
    handleNext() { },
    handleBack() { },
    variant,
    margin
});
function reducer(state, action) {
    switch (action.type) {
        case 'increase':
            return Object.assign(Object.assign({}, state), { activeStep: state.activeStep + 1 });
        case 'decrease':
            return Object.assign(Object.assign({}, state), { activeStep: state.activeStep - 1 });
        case 'form-value':
            return Object.assign(Object.assign({}, state), { formValues: Object.assign(Object.assign({}, state.formValues), { [action.name]: Object.assign(Object.assign({}, state.formValues[action.name]), { value: action.fieldValue }) }) });
        case 'form-error':
            return Object.assign(Object.assign({}, state), { formValues: Object.assign(Object.assign({}, state.formValues), { [action.name]: Object.assign(Object.assign({}, state.formValues[action.name]), { error: action.error }) }) });
        default:
            return state;
    }
}
export function StepsProvider({ children }) {
    const [{ activeStep, formValues }, dispatch] = useReducer(reducer, {
        activeStep: 0,
        formValues: initialValues
    });
    // Proceed to next step
    const handleNext = () => dispatch({ type: 'increase' });
    // Go back to prev step
    const handleBack = () => dispatch({ type: 'decrease' });
    // Handle form change
    const handleChange = (event, checked) => {
        const { type, name, value } = event.target;
        const fieldValue = type === 'checkbox' ? checked : value;
        dispatch({ type: 'form-value', name, fieldValue });
        const fieldName = initialValues[name];
        if (!fieldName)
            return;
        const { required, validate, minLength, maxLength, helperText } = fieldName;
        let error = '';
        if (required && !fieldValue)
            error = 'This field is required';
        if (minLength && value && value.length < minLength)
            error = `Minimum ${minLength} characters is required.`;
        if (maxLength && value && value.length > maxLength)
            error = 'Maximum length exceeded!';
        if (validate) {
            switch (validate) {
                case 'text':
                    if (value && !isText.test(value))
                        error = helperText || 'This field accepts text only.';
                    break;
                case 'number':
                    if (value && !isNumber.test(value))
                        error = helperText || 'This field accepts numbers only.';
                    break;
                case 'email':
                    if (value && !isEmail.test(value))
                        error = helperText || 'Please enter a valid email address.';
                    break;
                case 'phone':
                    if (value && !isPhone.test(value))
                        error =
                            helperText ||
                                'Please enter a valid phone number. i.e: xxx-xxx-xxxx';
                    break;
                case 'zip':
                    if (value && !isZip.test(value))
                        error = helperText || 'Please enter a valid zip code.';
                    break;
                case 'checkbox':
                    if (!checked)
                        error = helperText || 'Please provide a valid value.';
                    break;
                case 'select':
                    if (!value)
                        error = helperText || 'Please select a value.';
                    break;
                default:
                    break;
            }
        }
        dispatch({ type: 'form-error', name, error });
    };
    return (React.createElement(AppContext.Provider, { value: {
            activeStep,
            formValues,
            handleChange,
            handleNext,
            handleBack,
            variant,
            margin
        } },
        React.createElement("div", { className: "mui-step-form" }, children)));
}