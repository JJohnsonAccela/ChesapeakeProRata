/***************** TESTING **************************/
var timeOutSeconds = 55000; //Set to value slightly less than the timeout configured in the Batch config 

// Uncomment out the following record list definition to run against a subset of records (otherwise the script will process all Building/*/*/* records) 
var recList = ["UTL-FEE-2018-00043", "UTL-FEE-2018-00044", "UTL-FEE-2018-00038"]//["UTL-FEE-9603269-00", "UTL-FEE-9600015-00", "UTL-FEE-9601007-00", "UTL-FEE-9506012-00", "UTL-FEE-9506553-00", "UTL-FEE-9506437-00", "UTL-FEE-9603633-00", "UTL-FEE-9610165-00", "UTL-FEE-9608965-00", "UTL-FEE-9702004-00", "UTL-FEE-9607538-00", "UTL-FEE-9607566-00", "UTL-FEE-9604386-00", "UTL-FEE-9609728-00", "UTL-FEE-9610881-00", "UTL-FEE-2017-00012", "UTL-FEE-2015-00851", "UTL-FEE-2015-00855", "UTL-FEE-0008395-00"];

/****************************************************/

var userDefinedRecordSubet = (recList.length > 0);
var debug = "";
var showDebug = true;
var SCRIPT_VERSION = "3.0";
var currentUserID = "ADMIN";

var startDate = new Date();
startTime = startDate.getTime();
AInfo = [];
eval(getScriptText("INCLUDES_ACCELA_FUNCTIONS"));
eval(getScriptText("INCLUDES_CUSTOM"));
var br = ("" + aa.env.getValue("BatchJobName") == "") ? "" : "<br>";
timeOutSeconds = ("" + aa.env.getValue("BatchJobName") == "") ? 250 : timeOutSeconds; //Script Test has a 300 second hard timeout 

aa.print("" + aa.env.getValue("BatchJobName"));

function getScriptText(vScriptName) {
    vScriptName = vScriptName.toUpperCase();
    var emseBiz = aa.proxyInvoker.newInstance("com.accela.aa.emse.emse.EMSEBusiness").getOutput();
    //var emseScript = emseBiz.getScriptByPK(aa.getServiceProviderCode(),vScriptName,"ADMIN");
    var emseScript = emseBiz.getMasterScript(aa.getServiceProviderCode(), vScriptName);
    return emseScript.getScriptText() + "";
}

var sysDate = aa.date.getCurrentDate();
var sysDateMMDDYYYY = dateFormatted(sysDate.getMonth(), sysDate.getDayOfMonth(), sysDate.getYear(), "");
var systemUserObj = null; // Current User Object
var currentUserGroup = null; // Current User Group
var publicUserID = null;
var publicUser = false;
if (currentUserID.indexOf("PUBLICUSER") == 0) {
    publicUserID = currentUserID;
    currentUserID = "ADMIN";
    publicUser = true;
}
if (currentUserID != null) {
    systemUserObj = aa.person.getUser(currentUserID).getOutput(); // Current User Object
}
var useAppSpecificGroupName = false;

if (!userDefinedRecordSubet) {
    capResult = aa.cap.getByAppType("Utilities", "Connection Fees", "NA", "NA", 0, 999999);

    if (!capResult.getSuccess()) {
        aa.print("ERROR: Getting records, reason is: " + capResult.getErrorMessage());
        recList = [];
    } else {
        recList = capResult.getOutput();
    }
}

var updatedCount = 0;
var skippedValue = 0;
var notProRata = 0;

//Process Records
aa.print("Processing " + recList.length + " records");
aa.print("----------------------");
var undefinedGIS = [];
for (var i in recList) {
    if (elapsed() >= timeOutSeconds) {
        logDebug("Script Timeout... Processed " + i + "/" + recList.length + br);
        break;
    }

    var thisRec = recList[i];
    var capId = (userDefinedRecordSubet) ? aa.cap.getCapID("" + thisRec).getOutput() : thisRec.getCapID();
    var cap = aa.cap.getCap(capId)
    var altId = cap.getSuccess() ? "" + cap.getOutput().getCapModel().getAltID() : null;
    var fileDateYear = cap.getSuccess() ? cap.getOutput().getFileDate().getYear() : null;
    var isCapComplete = cap.getSuccess() ? cap.getOutput().isCompleteCap() : false;
    cap = cap.getOutput();
    loadAppSpecific(AInfo);

    logDebug(altId + br);

    if (!matches(cap.getCapStatus(), 'Withdrawn') && AInfo['Within Pro Rata Service Area'] != 'Yes') {
        var inProx = proximity("CHESAPEAKE", "Pro Rata Projects - PU", -5, "feet");

        if (inProx) {
            updateProRata4Batch();
            updatedCount++;
        } else {
            notProRata++;
            //not withinRata
            logDebug("**INFO Conn Fee Assess parcel on capId: " + capId + " not within pro rata area");
            editAppSpecific("Within Pro Rata Service Area", "No");
            editAppSpecific("Pro Rata Water", "No");
            editAppSpecific("Pro Rata Sewer", "No");
            //Note: do nothing confirm with agency.
        }
    } else {
        skippedValue++;
    }

    aa.print(debug);
    debug = '';
}

//outputloop TESTING ONLY
for (var f in recList) {
    var thisRec = recList[i];
    var capId = (userDefinedRecordSubet) ? aa.cap.getCapID("" + thisRec).getOutput() : thisRec.getCapID();
    var cap = aa.cap.getCap(capId);
    var altId = cap.getSuccess() ? "" + cap.getOutput().getCapModel().getAltID() : null;
    var fileDateYear = cap.getSuccess() ? cap.getOutput().getFileDate().getYear() : null;
    var isCapComplete = cap.getSuccess() ? cap.getOutput().isCompleteCap() : false;
    loadAppSpecific(AInfo);

    aa.print('-----------------------------');
    aa.print('Testing Results');
    aa.print('-----------------------------');
    aa.print(altId);

    aa.print('In Area:' + AInfo['Within Pro Rata Service Area']);
    aa.print('Water?:' + AInfo['Pro Rata Water']);
    aa.print('Sewer?:' + AInfo['Pro Rata Sewer']);
    aa.print('Developer:' + AInfo['Developer']);
    aa.print('Water Reimbursement:' + AInfo['Water Reimbursement Type']);
    aa.print('Sewer Reimbursement:' + AInfo['Sewer Reimbursement Type']);

    aa.print('----------------------------');
}

aa.print("---------------------------------------");
aa.print("Updated = " + updatedCount);
aa.print("Skipped = " + skippedValue);
aa.print("Out of Pro Rata = " + notProRata);
aa.print("total = " + (updatedCount + skippedValue + notProRata) + " of " + recList.length + "");

var thisDate = new Date();
aa.print("Runtime: " + ((thisDate.getTime() - startTime) / 1000));

function updateProRata4Batch() {

    var TOTAL_WATER_CONN_ACC_CODE = "00092";
    var TOTAL_SEWER_CONN_ACC_CODE = "00091";
    var REIMBURSABLE_WATER_ACC_CODE = "41031";
    var REIMBURSABLE_SEWER_ACC_CODE = "41031";

    var TOTAL_WATER_CONN_FEE_CODE = "UTL_020";
    var TOTAL_SEWER_CONN_FEE_CODE = "UTL_030";

    var TOTAL_SMALL_METER_CONN_FEE_CODE = "UTL_010";
    var TOTAL_FIRE_CONN_FEE_CODE = "UTL_021";
    var TOTAL_IRRIGATION_CONN_FEE_CODE = "UTL_022";
    var TOTAL_HRSD_CONN_FEE_CODE = "UTL_040";

    var REIMBURSABLE_WATER_CONN_FEE_CODE = "UTL_050";
    var REIMBURSABLE_SEWER_CONN_FEE_CODE = "UTL_060";

    var FEE_SCHED = "UTL_FEE_PAY";

    var REIMBURSE_MAP = [];
    REIMBURSE_MAP["Lump Sum"] = "Lump Sum";
    REIMBURSE_MAP["Connection Fee Credit"] = "Connection Fee Credit";
    REIMBURSE_MAP[""] = null;
    REIMBURSE_MAP["undefined"] = null;
    REIMBURSE_MAP[undefined] = null;

    var olduseAppSpecificGroupName = useAppSpecificGroupName;
    useAppSpecificGroupName = false;

    editAppSpecific("Within Pro Rata Service Area", "Yes");
    var gisBufferArray = getGISBufferInfo("CHESAPEAKE", "Pro Rata Projects - PU", -5, "TYPE", "INITIAL_DEV", "IMPROVID", "REIMBURSE");

    var gisProject = null;

    if (gisBufferArray.length == 1) {
        logDebug("**INFO Conn Fee Assess Single Project...");

        //Single project
        gisProject = gisBufferArray[0];

        //IMPROVID
        editAppSpecific("Project Name", gisProject["IMPROVID"]);

        //INITIAL_DEV
        var initDeveloper = gisProject["INITIAL_DEV"];
        if (initDeveloper != null && initDeveloper.equalsIgnoreCase("YES")) {
            editAppSpecific("Developer", "Initial");
        } else {
            editAppSpecific("Developer", "Subsequent");
        }

        //TYPE & REIMBURSE
        var type = gisProject["TYPE"];
        var reimburse = gisProject["REIMBURSE"];
        var reimburseMappedValue = REIMBURSE_MAP[reimburse];

        if (type != null && type.equalsIgnoreCase("WATER")) {
            editAppSpecific("Pro Rata Water", "Yes");
            editAppSpecific("Pro Rata Sewer", "No");
            if (reimburseMappedValue != null)
                editAppSpecific("Water Reimbursement Type", reimburseMappedValue);
        } else if (type != null && type.equalsIgnoreCase("SEWER")) {
            editAppSpecific("Pro Rata Water", "No");
            editAppSpecific("Pro Rata Sewer", "Yes");
            if (reimburseMappedValue != null)
                editAppSpecific("Sewer Reimbursement Type", reimburseMappedValue);
        }

    } else if (gisBufferArray.length > 1) {
        //Overlapping polygons (Multiple Projects)
        logDebug("**INFO Conn Fee Assess Overlapping polygons (Multiple Projects)...");

        for (var g in gisBufferArray) {
            if (gisBufferArray[g]["INITIAL_DEV"].equalsIgnoreCase("YES")) {
                gisProject = gisBufferArray[g];
                logDebug("**INFO Conn Fee Assess found init-dev=yes, updating ASIs...");

                //has INIT_DEV = YES
                editAppSpecific("Project Name", gisProject["IMPROVID"]);
                editAppSpecific("Developer", "Initial");

                //TYPE & REIMBURSE
                var type = gisProject["TYPE"];
                var reimburse = gisProject["REIMBURSE"];
                var reimburseMappedValue = REIMBURSE_MAP[reimburse];
                if (type != null && type.equalsIgnoreCase("WATER")) {
                    editAppSpecific("Pro Rata Water", "Yes");
                    if (reimburseMappedValue != null)
                        editAppSpecific("Water Reimbursement Type", reimburseMappedValue);
                } else if (type != null && type.equalsIgnoreCase("SEWER")) {
                    editAppSpecific("Pro Rata Sewer", "Yes");
                    if (reimburseMappedValue != null)
                        editAppSpecific("Sewer Reimbursement Type", reimburseMappedValue);
                }

            } //INIT_DEV
        } //for all gisBufferArray results

        //multiple projects, none of them is INIT-DEV
        if (gisProject == null) {
            logDebug("**INFO Conn Fee Assess multiple projects, none of them is INIT-DEV");
            editAppSpecific("Project Name", "");
            editAppSpecific("Developer", "Subsequent");
        }

    } else {
        logDebug("**WARN Conn Fee Assess no GIS-Projetcs found for capId: " + capId);
    } //single project
}

function elapsed() {
    var thisDate = new Date();
    var thisTime = thisDate.getTime();
    return ((thisTime - startTime) / 1000);
}