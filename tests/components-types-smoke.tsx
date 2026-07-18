import {
  KDNAAssetInspector,
  KDNAFileDropzone,
  KDNALicenseActivationForm,
  KDNALoadPlanGate,
  KDNAPasswordUnlockDialog,
  KDNATraceViewer,
  type KDNAActivationEntitlement,
} from "@aikdna/kdna-react";

const dropzone = (
  <KDNAFileDropzone endpoint="/api/kdna">
    {({ inspect, error }) => <pre>{JSON.stringify(inspect ?? error?.message ?? null)}</pre>}
  </KDNAFileDropzone>
);

const gate = (
  <KDNALoadPlanGate endpoint="/api/kdna" fileId="file-types">
    {({ status, content }) => <pre>{JSON.stringify({ status, content })}</pre>}
  </KDNALoadPlanGate>
);

const password = (
  <KDNAPasswordUnlockDialog endpoint="/api/kdna" fileId="file-types" />
);

const activation = (
  <KDNALicenseActivationForm
    endpoint="/api/kdna"
    domain="KDNA:Team.Name:Asset.Part:Variant_1"
    onActivated={(entitlement: KDNAActivationEntitlement) => entitlement.license_id}
  />
);

const inspector = <KDNAAssetInspector inspect={null} />;
const trace = <KDNATraceViewer visible={false} />;

void [dropzone, gate, password, activation, inspector, trace];
