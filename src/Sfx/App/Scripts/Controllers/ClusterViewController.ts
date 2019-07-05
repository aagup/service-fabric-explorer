//-----------------------------------------------------------------------------
// Copyright (c) Microsoft Corporation.  All rights reserved.
// Licensed under the MIT License. See License file under the project root for license information.
//-----------------------------------------------------------------------------

module Sfx {

    export interface IClusterViewScope extends angular.IScope {
        clusterAddress: string;
        nodesDashboard: IDashboardViewModel;
        appsDashboard: IDashboardViewModel;
        servicesDashboard: IDashboardViewModel;
        partitionsDashboard: IDashboardViewModel;
        replicasDashboard: IDashboardViewModel;
        upgradesDashboard: IDashboardViewModel;
        nodes: NodeCollection;
        nodesStatuses: INodesStatusDetails[];
        nodeStatusListSettings: ListSettings;
        systemApp: SystemApplication;
        clusterHealth: ClusterHealth;
        clusterManifest: ClusterManifest;
        imageStore: ImageStore;
        clusterUpgradeProgress: ClusterUpgradeProgress;
        clusterLoadInformation: ClusterLoadInformation;
        healthEventsListSettings: ListSettings;
        unhealthyEvaluationsListSettings: ListSettings;
        upgradeProgressUnhealthyEvaluationsListSettings: ListSettings;
        backupPolicyListSettings: ListSettings;
        metricsViewModel: IMetricsViewModel;
        upgradeAppsCount: number;
        appsUpgradeTabViewPath: string;
        clusterEvents: ClusterEventList;
        backupPolicies: BackupPolicyCollection;
        actions: ActionCollection;
    }

    export class ClusterViewController extends MainViewController {

        constructor($injector: angular.auto.IInjectorService, public $scope: IClusterViewScope) {
            super($injector, {
                "essentials": { name: "Essentials" },
                "details": { name: "Details" },
                "metrics": { name: "Metrics" },
                "clustermap": { name: "Cluster Map" },
                "imagestore": { name: "Image Store" },
                "manifest": { name: "Manifest" },
                "events": { name: "Events" },
                "backupPolicies": { name: "Backup Policies" },
            });

            $scope.actions = new ActionCollection(this.data.telemetry, this.data.$q);

            this.tabs["essentials"].refresh = (messageHandler) => this.refreshEssentials(messageHandler);
            this.tabs["details"].refresh = (messageHandler) => this.refreshDetails(messageHandler);
            this.tabs["clustermap"].refresh = (messageHandler) => this.refreshClusterMap(messageHandler);
            this.tabs["metrics"].refresh = (messageHandler) => this.refreshMetrics(messageHandler);
            this.tabs["manifest"].refresh = (messageHandler) => this.refreshManifest(messageHandler);
            this.tabs["imagestore"].refresh = (messageHandler) => this.refreshImageStore(messageHandler);
            this.tabs["events"].refresh = (messageHandler) => this.refreshEvents(messageHandler);
            this.tabs["backupPolicies"].refresh = (messageHandler) => this.refreshBackupPolicies(messageHandler);

            $scope.clusterAddress = this.$location.protocol() + "://" + this.$location.host();

            this.selectTreeNode([
                IdGenerator.cluster()
            ]);

            this.$scope.healthEventsListSettings = this.settings.getNewOrExistingHealthEventsListSettings();
            this.$scope.unhealthyEvaluationsListSettings = this.settings.getNewOrExistingUnhealthyEvaluationsListSettings();
            this.$scope.upgradeProgressUnhealthyEvaluationsListSettings = this.settings.getNewOrExistingUnhealthyEvaluationsListSettings("clusterUpgradeProgressUnhealthyEvaluations");
            this.$scope.nodeStatusListSettings = this.settings.getNewOrExistingNodeStatusListSetting();
            this.$scope.backupPolicyListSettings = this.settings.getNewOrExistingBackupPolicyListSettings();

            this.$scope.clusterHealth = this.data.getClusterHealth(HealthStateFilterFlags.Default, HealthStateFilterFlags.None, HealthStateFilterFlags.None);
            this.$scope.clusterUpgradeProgress = this.data.clusterUpgradeProgress;
            this.$scope.clusterLoadInformation = this.data.clusterLoadInformation;
            this.$scope.clusterManifest = this.data.clusterManifest;
            this.$scope.systemApp = this.data.systemApp;
            this.$scope.nodes = this.data.nodes;
            this.$scope.appsUpgradeTabViewPath = this.routes.getTabViewPath(this.routes.getAppsViewPath(), "upgrades");
            this.$scope.imageStore = this.data.imageStore;
            this.$scope.clusterEvents = this.data.createClusterEventList();
            this.$scope.nodesStatuses = [];
            this.$scope.backupPolicies = this.data.backupPolicies;
            this.refresh();
        }

        public getNodesForDomains(upgradeDomain: string, faultDomain: string): Node[] {
            return _.filter(this.$scope.nodes.collection, (node) => node.upgradeDomain === upgradeDomain && node.faultDomain === faultDomain);
        }

        private refreshEssentials(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            let promises: angular.IPromise<any>[] = [];

            // For unhealthy evaluations and dashboards
            promises.push(this.$scope.clusterHealth.refresh(messageHandler)
                .then((clusterHealth: ClusterHealth) => {
                    let nodesHealthStateCount = clusterHealth.getHealthStateCount(HealthStatisticsEntityKind.Node);
                    this.$scope.nodesDashboard = DashboardViewModel.fromHealthStateCount("Nodes", "Node", true, nodesHealthStateCount, this.data.routes, this.routes.getNodesViewPath());

                    let appsHealthStateCount = clusterHealth.getHealthStateCount(HealthStatisticsEntityKind.Application);
                    this.$scope.appsDashboard = DashboardViewModel.fromHealthStateCount("Applications", "Application", true, appsHealthStateCount, this.data.routes, this.routes.getAppsViewPath());

                    let servicesHealthStateCount = clusterHealth.getHealthStateCount(HealthStatisticsEntityKind.Service);
                    this.$scope.servicesDashboard = DashboardViewModel.fromHealthStateCount("Services", "Service", false, servicesHealthStateCount);

                    let partitionsDashboard = clusterHealth.getHealthStateCount(HealthStatisticsEntityKind.Partition);
                    this.$scope.partitionsDashboard = DashboardViewModel.fromHealthStateCount("Partitions", "Partition", false, partitionsDashboard);

                    let replicasHealthStateCount = clusterHealth.getHealthStateCount(HealthStatisticsEntityKind.Replica);
                    this.$scope.replicasDashboard = DashboardViewModel.fromHealthStateCount("Replicas", "Replica", false, replicasHealthStateCount);
                }));

            // For upgrade dashboard
            promises.push(this.data.getApps(true, messageHandler)
                .then(apps => {
                    this.$scope.upgradeAppsCount = _.filter(apps.collection, app => app.isUpgrading).length;
                }));

            // For healthy seed nodes / fault domains and upgrade domains
            promises.push(this.$scope.nodes.refresh(messageHandler));

            // For system application health state
            promises.push(this.$scope.systemApp.refresh(messageHandler));

            promises.push(this.$scope.clusterUpgradeProgress.refresh(messageHandler));

            return this.$q.all(promises);
        }

        private refreshClusterMap(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$scope.nodes.refresh(messageHandler);
        }

        private refreshDetails(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$q.all([
                this.$scope.clusterHealth.refresh(messageHandler),
                this.$scope.clusterUpgradeProgress.refresh(messageHandler),
                this.$scope.clusterLoadInformation.refresh(messageHandler),
                this.$scope.nodes.refresh(messageHandler).then( () => {
                    this.$scope.nodesStatuses = this.$scope.nodes.getNodeStateCounts();
                })
            ]);
        }

        private refreshMetrics(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$q.all([
                this.$scope.nodes.refresh(messageHandler),
                this.$scope.clusterLoadInformation.refresh(messageHandler)]).then(
                    () => {
                        if (!this.$scope.metricsViewModel) {
                            this.$scope.metricsViewModel =
                                this.settings.getNewOrExistingMetricsViewModel(this.$scope.clusterLoadInformation, _.map(this.$scope.nodes.collection, node => node.loadInformation));
                        }

                        let promises = _.map(this.$scope.nodes.collection, node => node.loadInformation.refresh(messageHandler));

                        return this.$q.all(promises).finally(() => {
                            this.$scope.metricsViewModel.refresh();
                        });
                    });
        }

        private refreshManifest(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$scope.clusterManifest.refresh(messageHandler);
        }

        private refreshEvents(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$scope.clusterEvents.refresh(new EventsStoreResponseMessageHandler(messageHandler));
        }

        private refreshImageStore(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            return this.$scope.imageStore.refresh(messageHandler);
        }
        private refreshBackupPolicies(messageHandler?: IResponseMessageHandler): angular.IPromise<any> {
            this.data.hasBackupRestoreService();
            if (this.data.actionsEnabled()) {
                this.setupActions();
            }
            return this.$scope.backupPolicies.refresh(messageHandler);
        }
        private setupActions() {
            if (!this.data.hide)
                this.$scope.actions.add(new ActionCreateBackupPolicy(this.data));
        }
    }
    export class ActionCreateBackupPolicy extends ActionWithDialog {

        public backupPolicy: IRawBackupPolicy; 
        public date: Date;
        public retentionPolicyRequired: boolean;
        public RetentionPolicy: IRawRetentionPolicy;
        public weekDay: string[];
        public isSelected: boolean[];
        public RunTimes: Date[];
        public days: number;
        public hours: number;
        public minutes: number;
         
        constructor(data: DataService) {
            super(
                data.$uibModal,
                data.$q,
                "createBackupPolicy",
                "Create Backup Policy",
                "Creating",
                () => this.createBackupPolicy(data),
                () => true,
                <angular.ui.bootstrap.IModalSettings>{
                    templateUrl: "partials/create-backup-policy-dialog.html",
                    controller: ActionController,
                    resolve: {
                        action: () => this
                    }
                },
                null);
            this.retentionPolicyRequired = false;
            this.date = new Date();
            this.date.setUTCSeconds(0, 0);
            this.weekDay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            this.isSelected = [false, false, false, false, false, false, false];
        }

        private createBackupPolicy(data: DataService): angular.IPromise<any> {
            if (this.retentionPolicyRequired) {
                this.RetentionPolicy.RetentionPolicyType = "Basic";
                this.backupPolicy['RetentionPolicy'] = this.RetentionPolicy;
            }
            else
                this.backupPolicy['RetentionPolicy'] = null;
            if (this.backupPolicy.Schedule.ScheduleKind === 'TimeBased') {
                this.backupPolicy.Schedule.RunTimes = [];
                for (let time of this.RunTimes)
                    this.backupPolicy.Schedule.RunTimes.push(time.toISOString().substr(11, 5) + "Z");
            }
            else
                this.backupPolicy.Schedule.Interval = "P" + this.days.toString() + "DT" + this.hours.toString() + "H" + this.minutes.toString() + "M";
            if (this.backupPolicy.Schedule.ScheduleKind === 'TimeBased' && this.backupPolicy.Schedule.ScheduleFrequencyType === 'Weekly') {
                this.backupPolicy.Schedule.RunDays = [];
                for (let i = 0; i < 7; i++) {
                    if (this.isSelected[i])
                        this.backupPolicy.Schedule.RunDays.push(this.weekDay[i]);
                }
            }
            return data.restClient.createBackupPolicy(this.backupPolicy);
        }

        public isInvalid(): boolean {
            if (this.backupPolicy.Schedule === null || this.backupPolicy.Schedule === undefined)
                return true;
            if (this.backupPolicy.Schedule.ScheduleKind === "FrequencyBased") {
                if (this.days === null || this.hours === null || this.minutes === null || this.days === undefined || this.hours === undefined || this.minutes === undefined || (this.days === 0 && this.hours === 0 && this.minutes === 0))
                    return true;
            }
            else {
                if (this.RunTimes === null || this.RunTimes === undefined)
                    return true;
                if (this.backupPolicy.Schedule.ScheduleFrequencyType === "Weekly") {
                    let check = false;
                    for (let i = 0; i < 7; i++) {
                        check = check || this.isSelected[i];
                    }
                    if (check === false)
                        return true;
                }
            }
            if (this.backupPolicy.Storage === null)
                return true;
            if (this.backupPolicy.Storage.StorageKind === null || this.backupPolicy.Storage.StorageKind === undefined)
                return true;
            if (this.backupPolicy.Storage.StorageKind === "FileShare") {
                if (this.backupPolicy.Storage.Path === null || this.backupPolicy.Storage.Path === undefined)
                    return true;
            }
            else {
                if (this.backupPolicy.Storage.ConnectionString === null || this.backupPolicy.Storage.ConnectionString === undefined || this.backupPolicy.Storage.ContainerName === null || this.backupPolicy.Storage.ContainerName === undefined)
                    return true;
            }
            return false;
        }

        public add(): void {
            if (this.RunTimes === null || this.RunTimes === undefined)
                this.RunTimes = [];
            this.RunTimes.push(this.date);
            this.date = new Date();
            this.date.setUTCSeconds(0, 0);
        }

        public deleteDate(index:number): void {
            this.RunTimes.splice(index,1);
        }
    }

    export class ActionUpdateBackupPolicy extends ActionWithDialog {

        public backupPolicy: IRawBackupPolicy;
        public date: Date;
        public retentionPolicyRequired: boolean;
        public RetentionPolicy: IRawRetentionPolicy;
        public weekDay: string[];
        public isSelected: boolean[];
        public delete: any;
        public RunTimes: Date[];
        public days: number;
        public hours: number;
        public minutes: number;

        constructor(data: DataService, raw: IRawBackupPolicy) {
            super(
                data.$uibModal,
                data.$q,
                "updateBackupPolicy",
                "Update Backup Policy",
                "Updating",
                () => this.updateBackupPolicy(data),
                () => true,
                <angular.ui.bootstrap.IModalSettings>{
                    templateUrl: "partials/update-backup-policy-dialog.html",
                    controller: ActionController,
                    resolve: {
                        action: () => this,
                    }
                },
                null);
            this.retentionPolicyRequired = false;
            this.date = new Date();
            this.date.setUTCSeconds(0, 0);
            this.weekDay = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
            this.isSelected = [false, false, false, false, false, false, false];
            let dayIndexMapping = {};
            for (let i = 0; i < 7; i++) {
                dayIndexMapping[this.weekDay[i]] = i;
            }

            this.backupPolicy = raw;
            if (this.backupPolicy['RetentionPolicy']) {
                this.retentionPolicyRequired = true;
                this.RetentionPolicy = this.backupPolicy['RetentionPolicy'];
            }
            if (this.backupPolicy.Schedule.RunDays) {
                for (let day of this.backupPolicy.Schedule.RunDays)
                    this.isSelected[dayIndexMapping[day]] = true;
            }
            if (this.backupPolicy.Schedule.ScheduleKind === 'TimeBased') {
                this.RunTimes = [];
                for (let date of this.backupPolicy.Schedule.RunTimes) {
                    this.RunTimes.push(new Date(date.substr(0, 16) + "Z"));
                }
            }
            else {
                let iso8601DurationRegex = /(-)?P(?:([.,\d]+)Y)?(?:([.,\d]+)M)?(?:([.,\d]+)W)?(?:([.,\d]+)D)?T(?:([.,\d]+)H)?(?:([.,\d]+)M)?(?:([.,\d]+)S)?/;
                let matches = this.backupPolicy.Schedule.Interval.match(iso8601DurationRegex);
                this.days = (matches[5] === undefined ? 0 : +matches[5]);
                this.hours= (matches[6] === undefined ? 0 : +matches[6]);
                this.minutes = (matches[7] === undefined ? 0 : +matches[7]);
            }
            this.backupPolicy.Storage.PrimaryPassword = null;
            this.backupPolicy.Storage.SecondaryPassword = null;
            this.backupPolicy.Storage.ConnectionString = null;
            this.delete = () => {
                data.restClient.deleteBackupPolicy(this.backupPolicy.Name);
            }
        }

        private updateBackupPolicy(data: DataService): angular.IPromise<any> {
            if (this.retentionPolicyRequired) {
                this.RetentionPolicy.RetentionPolicyType = "Basic";
                this.backupPolicy['RetentionPolicy'] = this.RetentionPolicy;
            }
            else
                this.backupPolicy['RetentionPolicy'] = null;
            if (this.backupPolicy.Schedule.ScheduleKind === 'TimeBased') {
                this.backupPolicy.Schedule.RunTimes = [];
                for (let time of this.RunTimes)
                    this.backupPolicy.Schedule.RunTimes.push(time.toISOString().substr(11, 5) + "Z");
            }
            else
                this.backupPolicy.Schedule.Interval = "P" + this.days.toString() + "DT" + this.hours.toString() + "H" + this.minutes.toString() + "M";
            if (this.backupPolicy.Schedule.ScheduleKind === 'TimeBased' && this.backupPolicy.Schedule.ScheduleFrequencyType === 'Weekly') {
                this.backupPolicy.Schedule.RunDays = [];
                for (let i = 0; i < 7; i++) {
                    if (this.isSelected[i])
                        this.backupPolicy.Schedule.RunDays.push(this.weekDay[i]);
                }
            }
            return data.restClient.updateBackupPolicy(this.backupPolicy);
        }

        public add(): void {
            if (this.RunTimes === null || this.RunTimes === undefined)
                this.RunTimes = [];
            this.RunTimes.push(this.date);
            this.date = new Date();
            this.date.setUTCSeconds(0, 0);
        }

        public deleteDate(index: number): void {
            this.RunTimes.splice(index, 1);
        }

        public isInvalid(): boolean {
            if (this.backupPolicy.Schedule === null || this.backupPolicy.Schedule === undefined)
                return true;
            if (this.backupPolicy.Schedule.ScheduleKind === "FrequencyBased") {
                if (this.days === null || this.hours === null || this.minutes === null || this.days === undefined || this.hours === undefined || this.minutes === undefined || (this.days === 0 && this.hours === 0 && this.minutes === 0))
                    return true;
            }
            else {
                if (this.RunTimes === null || this.RunTimes === undefined)
                    return true;
                if (this.backupPolicy.Schedule.ScheduleFrequencyType === "Weekly") {
                    let check = false;
                    for (let i = 0; i < 7; i++) {
                        check = check || this.isSelected[i];
                    }
                    if (check === false)
                        return true;
                }
            }
            if (this.backupPolicy.Storage === null)
                return true;
            if (this.backupPolicy.Storage.StorageKind === null || this.backupPolicy.Storage.StorageKind === undefined)
                return true;
            if (this.backupPolicy.Storage.StorageKind === "FileShare") {
                if (this.backupPolicy.Storage.Path === null || this.backupPolicy.Storage.Path === undefined)
                    return true;
            }
            else {
                if (this.backupPolicy.Storage.ConnectionString === null || this.backupPolicy.Storage.ConnectionString === undefined || this.backupPolicy.Storage.ContainerName === null || this.backupPolicy.Storage.ContainerName === undefined)
                    return true;
            }
            return false;
        }

    }
    (function () {

        let module = angular.module("clusterViewController", ["dataService", "filters"]);
        module.controller("ClusterViewController", ["$injector", "$scope", ClusterViewController]);

    })();
}
