import { Inputs } from './Inputs';
import * as core from '@actions/core';
import { Releases } from './Releases';
import { ArtifactUploader } from './ArtifactUploader';
import { ErrorMessage } from './ErrorMessage';

import {
  ReposCreateReleaseResponse,
  ReposUpdateReleaseResponse,
  ReposListAssetsForReleaseResponseItem,
} from '@octokit/rest';

export class Action {
  private inputs: Inputs;
  private releases: Releases;
  private uploader: ArtifactUploader;

  constructor(inputs: Inputs, releases: Releases, uploader: ArtifactUploader) {
    this.inputs = inputs;
    this.releases = releases;
    this.uploader = uploader;
  }

  async perform() {
    const { id: release_id, upload_url } = await this.createOrUpdateRelease();

    const assets = await this.releases.listArtifacts(release_id);

    core.debug(`List of assets: ${assets.data.map(a => `'${a.name}'`).join(',')}`);

    const artifacts = this.inputs.artifacts;
    if (artifacts.length > 0) {
      for (const artifact of artifacts) {
        core.debug(`Checking if asset '${artifact.name}' exists`);
        try {
          const assetId = assets.data.find(asset => asset.name === artifact.name)?.id;
          if (assetId) {
            await this.releases.deleteArtifact(assetId);
            core.debug(`Deleting '${artifact.name}'`);
          }
        } catch (e) {
          core.warning(e);
        }
      }
      await this.uploader.uploadArtifacts(artifacts, upload_url);
    }
  }

  private async createOrUpdateRelease(): Promise<ReposCreateReleaseResponse | ReposUpdateReleaseResponse> {
    if (this.inputs.allowUpdates) {
      try {
        const getResponse = await this.releases.getByTag(this.inputs.tag);
        return await this.updateRelease(getResponse.data.id);
      } catch (error) {
        if (this.noPublishedRelease(error)) {
          return await this.updateDraftOrCreateRelease();
        } else {
          throw error;
        }
      }
    } else {
      return await this.createRelease();
    }
  }

  private async updateRelease(id: number): Promise<ReposUpdateReleaseResponse> {
    const response = await this.releases.update(
      id,
      this.inputs.tag,
      this.inputs.body,
      this.inputs.commit,
      this.inputs.draft,
      this.inputs.name,
      this.inputs.prerelease,
    );

    return response.data;
  }

  private noPublishedRelease(error: any): boolean {
    const errorMessage = new ErrorMessage(error);
    return errorMessage.status == 404;
  }

  private async updateDraftOrCreateRelease(): Promise<ReposCreateReleaseResponse | ReposUpdateReleaseResponse> {
    const draftReleaseId = await this.findMatchingDraftReleaseId();
    if (draftReleaseId) {
      return await this.updateRelease(draftReleaseId);
    } else {
      return await this.createRelease();
    }
  }

  private async findMatchingDraftReleaseId(): Promise<number | undefined> {
    const tag = this.inputs.tag;
    const response = await this.releases.listReleases();
    const releases = response.data;
    const draftRelease = releases.find(release => release.draft && release.tag_name == tag);

    return draftRelease?.id;
  }

  private async createRelease(): Promise<ReposCreateReleaseResponse> {
    const response = await this.releases.create(
      this.inputs.tag,
      this.inputs.body,
      this.inputs.commit,
      this.inputs.draft,
      this.inputs.name,
      this.inputs.prerelease,
    );

    return response.data;
  }
}
