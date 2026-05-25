import { OrgNode, DivisionNode, FacilityNode, BuildingNode, ProcessNode, ProductNode, VehicleFleetNode } from "./nodes/OrgNodes.js";
import { GridConnectionNode, SolarNode, WindNode, HydroNode, NaturalGasNode, PPAContractNode, ScopeGroupNode } from "./nodes/EnergyNodes.js";
import { MeterNode, ApiSourceNode, ManualEntryNode, EmissionCalcNode, CfMatchingNode, CbamCalcNode, CbamReportNode, GhgReportNode } from "./nodes/PipelineNodes.js";

export const nodeTypes = {
  // Org + Resource
  orgNode:          OrgNode,
  divisionNode:     DivisionNode,
  facilityNode:     FacilityNode,
  buildingNode:     BuildingNode,
  processNode:      ProcessNode,
  productNode:      ProductNode,
  vehicleFleetNode: VehicleFleetNode,
  // Energy + Scope Boundary
  gridNode:         GridConnectionNode,
  solarNode:        SolarNode,
  windNode:         WindNode,
  hydroNode:        HydroNode,
  naturalGasNode:   NaturalGasNode,
  ppaContractNode:  PPAContractNode,
  scopeGroupNode:   ScopeGroupNode,
  // Pipeline + Calc + Output
  meterNode:        MeterNode,
  apiSourceNode:    ApiSourceNode,
  manualEntryNode:  ManualEntryNode,
  emissionCalcNode: EmissionCalcNode,
  cfMatchingNode:   CfMatchingNode,
  cbamCalcNode:     CbamCalcNode,
  cbamReportNode:   CbamReportNode,
  ghgReportNode:    GhgReportNode,
} as const;
