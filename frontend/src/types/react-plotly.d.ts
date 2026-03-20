declare module "react-plotly.js/factory" {
  import { Component } from "react";

  interface PlotParams {
    data: any[];
    layout?: any;
    config?: any;
    style?: React.CSSProperties;
    className?: string;
    useResizeHandler?: boolean;
  }

  function createPlotlyComponent(plotly: any): new (props: PlotParams) => Component<PlotParams>;
  export default createPlotlyComponent;
}

declare module "plotly.js-dist-min" {
  const Plotly: any;
  export default Plotly;
}
