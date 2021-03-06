import { Project } from './project.model';
import { existsSync, readJsonSync, createFileSync, writeJsonSync } from 'fs-extra';
import { FILES_EXCLUDE } from './constants';
import { workspace } from 'vscode';

export class ExclusionController {

    updateExclusions(projects: { selected: Project[], unselected: Project[] }): void {
        if (projects.selected.length > 0) {
            const patterns = this.mergeExclusions(projects.selected);
            const excludedroots = this.extractExcludedRoots(projects.selected, projects.unselected);
            const assets = this.mergeAssets(projects.selected, projects.unselected);
            const allPatterns = this.addDependencies(patterns);
            const settings = this.updateSettings({ ...excludedroots, ...allPatterns, ...assets });
            writeJsonSync(this.settingsPath, settings);
        } else {
            this.resetExclusions();
        }
    }

    resetExclusions(): void {
        const settings = this.updateSettings({});
        writeJsonSync(this.settingsPath, settings);
    }

    private extractExcludedRoots(selected: Project[], unselected: Project[]): { [key: string]: boolean } {
        const result: { [key: string]: boolean } = {};
        const selectedRoots = selected.map(s => s.root);
        const unSelectedRoots = unselected.map(s => s.root);
        const ignoreRoots = unSelectedRoots.filter(us => selectedRoots.indexOf(us) === -1);
        ignoreRoots.forEach(ir => result[ir] = true);
        return result;
    }

    private mergeAssets(selected: Project[], unselected: Project[]): { [key: string]: boolean } {
        const result: { [key: string]: boolean } = {};
        const unselectedAssets: string[] = [];
        const selectedAssets: string[] = [];
        unselected.forEach(u => unselectedAssets.push(...u.assets));
        selected.forEach(u => selectedAssets.push(...u.assets));

        const intersections = unselectedAssets.filter(ud => selectedAssets.indexOf(ud) === -1);
        intersections.forEach(p => result[p] = true);
        return result;
    }

    private mergeExclusions(selected: Project[]): { [key: string]: boolean } {
        const result: { [key: string]: boolean } = {};
        const exclusions = selected.map(s => s.exclude.filter((e: string) => s.include.indexOf(e) === -1));

        if (exclusions && exclusions.length > 0) {
            let intersections = exclusions[0];
            for (let i = 1; i < exclusions.length; i++) {
                intersections = intersections.filter(v => exclusions[i].some(p => p === v));
            }
            intersections.forEach(p => result[p] = true);
        }
        return result;
    }

    private addDependencies(patterns: { [key: string]: boolean }): { [key: string]: object | boolean } {
        const additionalPatterns: { [key: string]: object | boolean } = {};
        const whenCondition = { 'when': '$(basename).ts' };
        Object.keys(patterns).forEach(p => {
            additionalPatterns[p] = true;
            if (p.includes('.ts')) {
                const html = p.replace('.ts', '.html');
                const scss = p.replace('.ts', '.scss');
                additionalPatterns[html] = whenCondition;
                additionalPatterns[scss] = whenCondition;
            }
        });
        return additionalPatterns;
    }

    private updateSettings(patterns: { [key: string]: boolean | object }): { [key: string]: any } {
        const settings = this.getCurrentSettings();
        settings[FILES_EXCLUDE] = patterns;
        return settings;
    }

    private getCurrentSettings(): { [key: string]: any } {
        if (existsSync(this.settingsPath)) {
            return readJsonSync(this.settingsPath);
        } else {
            createFileSync(this.settingsPath);
        }
        return {};
    }

    private get settingsPath(): string {
        return `${workspace.rootPath}\\.vscode\\settings.json`;
    }
}