import * as React from "react"
import { useSize } from "../../hooks/use-size"
import { DEFAULT_TRANSFORM_WIDTH } from "./image-helpers"
export function useResponsiveImage({parsed,fittingType,focalPoint,quality,onLoad},parentRef){const wrapperRef=React.useRef(null),imgRef=React.useRef(null),size=useSize(wrapperRef),[loaded,setLoaded]=React.useState(false);React.useImperativeHandle(parentRef,()=>imgRef.current);React.useEffect(()=>setLoaded(false),[parsed?.baseUrl]);const crop=fittingType!=="fit";const options=size&&{width:size.width||DEFAULT_TRANSFORM_WIDTH,height:size.height||undefined,crop,focalPoint:crop?focalPoint:undefined,quality};return{wrapperRef,imgRef,loaded,options,handleLoad:e=>{setLoaded(true);onLoad?.(e)}}}
