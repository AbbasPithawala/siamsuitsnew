import { useState } from "react";
import type { ChangeEvent, ReactNode } from "react";
import { Link as RouterLink, useParams } from "react-router-dom";
import Alert from "@mui/material/Alert";
import Avatar from "@mui/material/Avatar";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Divider from "@mui/material/Divider";
import IconButton from "@mui/material/IconButton";
import Paper from "@mui/material/Paper";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
// Named barrel import — see ProductsPage.tsx's comment on this project's
// Vite dep optimizer mis-transforming `@mui/icons-material/X` deep imports.
import {
  Add as AddIcon,
  ArrowBack as ArrowBackIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  Delete as DeleteIcon,
  Edit as EditIcon,
} from "@mui/icons-material";
import { getApiErrorMessage } from "../../api/errorUtils";
import { LoadingSpinner } from "../../components/LoadingSpinner";
import { resolveUploadUrl, useUploadFileMutation } from "../uploads/uploadsApi";
import { useHasPermission } from "../auth/useHasPermission";
import {
  useCreateStyleMutation,
  useCreateStyleOptionMutation,
  useDeleteStyleMutation,
  useDeleteStyleOptionMutation,
  useGetFeatureQuery,
  useUpdateStyleMutation,
  useUpdateStyleOptionMutation,
} from "./featuresApi";
import type { FeatureStyle, StyleInput, StyleOptionInput } from "./featuresApi";

const EMPTY_STYLE_DRAFT: StyleInput = { name: "", thaiName: "", image: "", price: "", workerPrice: "" };
const EMPTY_OPTION_DRAFT: StyleOptionInput = { name: "", image: "" };

function isCompleteStyleDraft(draft: StyleInput): boolean {
  return draft.name.trim().length > 0;
}

function isCompleteOptionDraft(draft: StyleOptionInput): boolean {
  return draft.name.trim().length > 0;
}

function toStyleBody(draft: StyleInput): StyleInput {
  const body: StyleInput = { name: draft.name.trim() };
  const thaiName = draft.thaiName?.trim();
  if (thaiName) body.thaiName = thaiName;
  const image = draft.image?.trim();
  if (image) body.image = image;
  const price = draft.price?.trim();
  if (price) body.price = price;
  const workerPrice = draft.workerPrice?.trim();
  if (workerPrice) body.workerPrice = workerPrice;
  return body;
}

function toOptionBody(draft: StyleOptionInput): StyleOptionInput {
  const body: StyleOptionInput = { name: draft.name.trim() };
  const image = draft.image?.trim();
  if (image) body.image = image;
  return body;
}

/**
 * A compact "thumbnail + Upload image" control, backed by the same generic
 * `POST /uploads` endpoint `RetailerProfilePage.tsx`/`CustomerFormFields.tsx`
 * already use — replaces this page's previous raw "image URL" text field
 * (what `FeatureStylesEditor.tsx`, the dialog-nested version this page
 * replaces, still had) now that an admin has no reason to know or paste a
 * real upload URL by hand.
 */
function StyleImageField({
  image,
  onChange,
  disabled,
  uploadLabel,
}: {
  image: string | undefined;
  onChange: (url: string) => void;
  disabled?: boolean;
  uploadLabel: string;
}) {
  const [uploadFile, uploadState] = useUploadFileMutation();

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const result = await uploadFile(file).unwrap();
      onChange(result.url);
    } catch {
      // surfaced below via uploadState.error
    }
  }

  return (
    <Stack spacing={0.5}>
      <Stack direction="row" spacing={1} alignItems="center">
        <Avatar variant="rounded" {...(image ? { src: resolveUploadUrl(image) } : {})} sx={{ width: 40, height: 40 }} />
        <Button component="label" size="small" variant="outlined" disabled={disabled || uploadState.isLoading}>
          {uploadState.isLoading ? "Uploading…" : uploadLabel}
          <input type="file" accept="image/*" hidden onChange={handleFileChange} />
        </Button>
      </Stack>
      {uploadState.error && (
        <Typography variant="caption" color="error">
          {getApiErrorMessage(uploadState.error, "Failed to upload image.")}
        </Typography>
      )}
    </Stack>
  );
}

/**
 * Dedicated styles/style-options management page for one `type: "choice"`
 * feature — reachable from `FeaturesPage.tsx`'s table ("Manage" in the
 * Styles column), mirroring `FittingsPage.tsx` → `FittingValuesPage.tsx`'s
 * own list-page → drill-down-page split rather than nesting this editor
 * inside the Edit Feature dialog the way `FeatureStylesEditor.tsx` (now
 * deleted) used to. That inline version is also the direct legacy analogue
 * of `ManageStyleOptionForm.jsx` (feature metadata only) vs. the separate
 * `ManageEditStyling.jsx` page (the actual style rows) — this rewrite now
 * matches that same two-screen split.
 */
export function FeatureStylesPage() {
  const { featureId } = useParams<{ featureId: string }>();
  if (!featureId) {
    return <Alert severity="error">Missing feature.</Alert>;
  }
  return <FeatureStylesPageContent key={featureId} featureId={featureId} />;
}

function FeatureStylesPageContent({ featureId }: { featureId: string }) {
  const canManage = useHasPermission("catalog.features.manage");
  const { data: feature, isLoading, isError, error } = useGetFeatureQuery(featureId);

  const backLink = (
    <Button component={RouterLink} to="/catalog/features" startIcon={<ArrowBackIcon />}>
      Back to Features
    </Button>
  );

  if (isLoading) {
    return <LoadingSpinner />;
  }

  if (isError || !feature) {
    return (
      <Box sx={{ p: 4 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
          <Typography variant="h5">Styles</Typography>
          {backLink}
        </Stack>
        <Alert severity="error">{getApiErrorMessage(error, "Failed to load this feature.")}</Alert>
      </Box>
    );
  }

  return <StylesEditor featureId={feature.id} featureName={feature.name} styles={feature.styles ?? []} canManage={canManage} backLink={backLink} />;
}

function StylesEditor({
  featureId,
  featureName,
  styles,
  canManage,
  backLink,
}: {
  featureId: string;
  featureName: string;
  styles: FeatureStyle[];
  canManage: boolean;
  backLink: ReactNode;
}) {
  const [createStyle, createStyleState] = useCreateStyleMutation();
  const [updateStyle] = useUpdateStyleMutation();
  const [deleteStyle] = useDeleteStyleMutation();
  const [createStyleOption, createStyleOptionState] = useCreateStyleOptionMutation();
  const [updateStyleOption] = useUpdateStyleOptionMutation();
  const [deleteStyleOption] = useDeleteStyleOptionMutation();

  const [addingStyle, setAddingStyle] = useState(false);
  const [newStyleDraft, setNewStyleDraft] = useState<StyleInput>(EMPTY_STYLE_DRAFT);
  const [editingStyleId, setEditingStyleId] = useState<string | null>(null);
  const [editStyleDraft, setEditStyleDraft] = useState<StyleInput>(EMPTY_STYLE_DRAFT);

  const [addingOptionForStyleId, setAddingOptionForStyleId] = useState<string | null>(null);
  const [newOptionDraft, setNewOptionDraft] = useState<StyleOptionInput>(EMPTY_OPTION_DRAFT);
  const [editingOptionId, setEditingOptionId] = useState<string | null>(null);
  const [editOptionDraft, setEditOptionDraft] = useState<StyleOptionInput>(EMPTY_OPTION_DRAFT);

  const [actionError, setActionError] = useState<string | null>(null);

  function resetStyleEditing() {
    setAddingStyle(false);
    setNewStyleDraft(EMPTY_STYLE_DRAFT);
    setEditingStyleId(null);
    setEditStyleDraft(EMPTY_STYLE_DRAFT);
  }

  function resetOptionEditing() {
    setAddingOptionForStyleId(null);
    setNewOptionDraft(EMPTY_OPTION_DRAFT);
    setEditingOptionId(null);
    setEditOptionDraft(EMPTY_OPTION_DRAFT);
  }

  async function handleAddStyle() {
    if (!isCompleteStyleDraft(newStyleDraft)) return;
    setActionError(null);
    try {
      await createStyle({ featureId, body: toStyleBody(newStyleDraft) }).unwrap();
      resetStyleEditing();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to add style."));
    }
  }

  function startStyleEdit(style: FeatureStyle) {
    setEditingStyleId(style.id);
    setEditStyleDraft({
      name: style.name,
      thaiName: style.thaiName ?? "",
      image: style.image ?? "",
      price: style.price,
      workerPrice: style.workerPrice,
    });
    setActionError(null);
  }

  async function handleSaveStyleEdit() {
    if (!editingStyleId || !isCompleteStyleDraft(editStyleDraft)) return;
    setActionError(null);
    try {
      await updateStyle({ featureId, styleId: editingStyleId, body: toStyleBody(editStyleDraft) }).unwrap();
      resetStyleEditing();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to update style."));
    }
  }

  async function handleDeleteStyle(styleId: string) {
    setActionError(null);
    try {
      await deleteStyle({ featureId, styleId }).unwrap();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to delete style."));
    }
  }

  async function handleAddOption(styleId: string) {
    if (!isCompleteOptionDraft(newOptionDraft)) return;
    setActionError(null);
    try {
      await createStyleOption({ featureId, styleId, body: toOptionBody(newOptionDraft) }).unwrap();
      resetOptionEditing();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to add style option."));
    }
  }

  function startOptionEdit(option: FeatureStyle["options"][number]) {
    setEditingOptionId(option.id);
    setEditOptionDraft({ name: option.name, image: option.image ?? "" });
    setActionError(null);
  }

  async function handleSaveOptionEdit() {
    if (!editingOptionId || !isCompleteOptionDraft(editOptionDraft)) return;
    setActionError(null);
    try {
      await updateStyleOption({ featureId, optionId: editingOptionId, body: toOptionBody(editOptionDraft) }).unwrap();
      resetOptionEditing();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to update style option."));
    }
  }

  async function handleDeleteOption(optionId: string) {
    setActionError(null);
    try {
      await deleteStyleOption({ featureId, optionId }).unwrap();
    } catch (err) {
      setActionError(getApiErrorMessage(err, "Failed to delete style option."));
    }
  }

  return (
    <Box sx={{ p: 4 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Typography variant="h5">{featureName} — Styles</Typography>
        {backLink}
      </Stack>

      <Typography variant="subtitle2" gutterBottom>
        Styles ({styles.length})
      </Typography>
      <Stack spacing={1.5}>
        {styles.map((style) => (
          <Paper key={style.id} variant="outlined" sx={{ p: 1.5 }}>
            {editingStyleId === style.id ? (
              <Stack spacing={1}>
                <Stack direction="row" spacing={1}>
                  <TextField
                    label="Style name"
                    size="small"
                    fullWidth
                    value={editStyleDraft.name}
                    onChange={(event) => setEditStyleDraft((current) => ({ ...current, name: event.target.value }))}
                  />
                  <TextField
                    label="Style thai name"
                    size="small"
                    fullWidth
                    value={editStyleDraft.thaiName ?? ""}
                    onChange={(event) => setEditStyleDraft((current) => ({ ...current, thaiName: event.target.value }))}
                  />
                </Stack>
                <Stack direction="row" spacing={1} alignItems="center">
                  <StyleImageField
                    image={editStyleDraft.image}
                    onChange={(url) => setEditStyleDraft((current) => ({ ...current, image: url }))}
                    uploadLabel="Upload image"
                  />
                  <TextField
                    label="Price"
                    size="small"
                    fullWidth
                    value={editStyleDraft.price ?? ""}
                    onChange={(event) => setEditStyleDraft((current) => ({ ...current, price: event.target.value }))}
                  />
                  <TextField
                    label="Worker price"
                    size="small"
                    fullWidth
                    value={editStyleDraft.workerPrice ?? ""}
                    onChange={(event) => setEditStyleDraft((current) => ({ ...current, workerPrice: event.target.value }))}
                  />
                  <IconButton
                    aria-label={`Save style ${style.name}`}
                    onClick={handleSaveStyleEdit}
                    disabled={!isCompleteStyleDraft(editStyleDraft)}
                  >
                    <CheckIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label="Cancel style edit" onClick={resetStyleEditing}>
                    <CloseIcon fontSize="small" />
                  </IconButton>
                </Stack>
              </Stack>
            ) : (
              <Stack direction="row" justifyContent="space-between" alignItems="center">
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Avatar variant="rounded" {...(style.image ? { src: resolveUploadUrl(style.image) } : {})} sx={{ width: 40, height: 40 }} />
                  <Typography variant="body2">
                    {style.name}
                    {style.thaiName ? ` (${style.thaiName})` : ""} — price {style.price}, worker {style.workerPrice}
                  </Typography>
                </Stack>
                {canManage && (
                  <Box>
                    <IconButton aria-label={`Edit style ${style.name}`} onClick={() => startStyleEdit(style)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                    <IconButton aria-label={`Delete style ${style.name}`} onClick={() => handleDeleteStyle(style.id)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                )}
              </Stack>
            )}

            <Box sx={{ mt: 1, pl: 2, borderLeft: "3px solid", borderColor: "divider" }}>
              <Typography variant="caption" color="text.secondary">
                Style options ({style.options.length})
              </Typography>
              <Stack spacing={1} sx={{ mt: 0.5 }}>
                {style.options.map((option) =>
                  editingOptionId === option.id ? (
                    <Stack direction="row" spacing={1} alignItems="center" key={option.id}>
                      <TextField
                        label="Option name"
                        size="small"
                        fullWidth
                        value={editOptionDraft.name}
                        onChange={(event) => setEditOptionDraft((current) => ({ ...current, name: event.target.value }))}
                      />
                      <StyleImageField
                        image={editOptionDraft.image}
                        onChange={(url) => setEditOptionDraft((current) => ({ ...current, image: url }))}
                        uploadLabel="Upload image"
                      />
                      <IconButton
                        aria-label={`Save option ${option.name}`}
                        onClick={handleSaveOptionEdit}
                        disabled={!isCompleteOptionDraft(editOptionDraft)}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Cancel option edit" onClick={resetOptionEditing}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Stack direction="row" spacing={1.5} justifyContent="space-between" alignItems="center" key={option.id}>
                      <Stack direction="row" spacing={1.5} alignItems="center">
                        <Avatar variant="rounded" {...(option.image ? { src: resolveUploadUrl(option.image) } : {})} sx={{ width: 32, height: 32 }} />
                        <Typography variant="body2">{option.name}</Typography>
                      </Stack>
                      {canManage && (
                        <Box>
                          <IconButton aria-label={`Edit option ${option.name}`} onClick={() => startOptionEdit(option)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                          <IconButton aria-label={`Delete option ${option.name}`} onClick={() => handleDeleteOption(option.id)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      )}
                    </Stack>
                  )
                )}

                {canManage &&
                  (addingOptionForStyleId === style.id ? (
                    <Stack direction="row" spacing={1} alignItems="center">
                      <TextField
                        label="Option name"
                        size="small"
                        fullWidth
                        value={newOptionDraft.name}
                        onChange={(event) => setNewOptionDraft((current) => ({ ...current, name: event.target.value }))}
                      />
                      <StyleImageField
                        image={newOptionDraft.image}
                        onChange={(url) => setNewOptionDraft((current) => ({ ...current, image: url }))}
                        uploadLabel="Upload image"
                      />
                      <IconButton
                        aria-label="Save new option"
                        onClick={() => handleAddOption(style.id)}
                        disabled={!isCompleteOptionDraft(newOptionDraft) || createStyleOptionState.isLoading}
                      >
                        <CheckIcon fontSize="small" />
                      </IconButton>
                      <IconButton aria-label="Cancel new option" onClick={resetOptionEditing}>
                        <CloseIcon fontSize="small" />
                      </IconButton>
                    </Stack>
                  ) : (
                    <Button
                      size="small"
                      startIcon={<AddIcon />}
                      onClick={() => {
                        setAddingOptionForStyleId(style.id);
                        setNewOptionDraft(EMPTY_OPTION_DRAFT);
                        setActionError(null);
                      }}
                      sx={{ alignSelf: "flex-start" }}
                    >
                      Add option
                    </Button>
                  ))}
              </Stack>
            </Box>
          </Paper>
        ))}
      </Stack>

      {canManage && (
        <>
          <Divider sx={{ my: 1.5 }} />

          {addingStyle ? (
            <Stack spacing={1}>
              <Stack direction="row" spacing={1}>
                <TextField
                  label="Style name"
                  size="small"
                  fullWidth
                  value={newStyleDraft.name}
                  onChange={(event) => setNewStyleDraft((current) => ({ ...current, name: event.target.value }))}
                />
                <TextField
                  label="Style thai name"
                  size="small"
                  fullWidth
                  value={newStyleDraft.thaiName ?? ""}
                  onChange={(event) => setNewStyleDraft((current) => ({ ...current, thaiName: event.target.value }))}
                />
              </Stack>
              <Stack direction="row" spacing={1} alignItems="center">
                <StyleImageField
                  image={newStyleDraft.image}
                  onChange={(url) => setNewStyleDraft((current) => ({ ...current, image: url }))}
                  uploadLabel="Upload image"
                />
                <TextField
                  label="Price"
                  size="small"
                  fullWidth
                  value={newStyleDraft.price ?? ""}
                  onChange={(event) => setNewStyleDraft((current) => ({ ...current, price: event.target.value }))}
                />
                <TextField
                  label="Worker price"
                  size="small"
                  fullWidth
                  value={newStyleDraft.workerPrice ?? ""}
                  onChange={(event) => setNewStyleDraft((current) => ({ ...current, workerPrice: event.target.value }))}
                />
                <IconButton
                  aria-label="Save new style"
                  onClick={handleAddStyle}
                  disabled={!isCompleteStyleDraft(newStyleDraft) || createStyleState.isLoading}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
                <IconButton aria-label="Cancel new style" onClick={resetStyleEditing}>
                  <CloseIcon fontSize="small" />
                </IconButton>
              </Stack>
            </Stack>
          ) : (
            <Button
              startIcon={<AddIcon />}
              onClick={() => {
                setAddingStyle(true);
                setNewStyleDraft(EMPTY_STYLE_DRAFT);
                setActionError(null);
              }}
              sx={{ alignSelf: "flex-start" }}
            >
              Add style
            </Button>
          )}
        </>
      )}

      {actionError && (
        <Alert severity="error" sx={{ mt: 1.5 }}>
          {actionError}
        </Alert>
      )}
    </Box>
  );
}
