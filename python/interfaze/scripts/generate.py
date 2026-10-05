"""Generate Pydantic response models and TypedDict request params from openapi/openapi.json."""

from pathlib import Path

from datamodel_code_generator import DataModelType, InputFileType, PythonVersion, generate
from datamodel_code_generator.format import Formatter

ROOT = Path(__file__).resolve().parents[3]
SPEC = ROOT / "openapi" / "openapi.json"
OUT = Path(__file__).resolve().parents[1] / "src" / "interfaze" / "_generated"

COMMON = {
    "input_file_type": InputFileType.OpenAPI,
    "target_python_version": PythonVersion.PY_310,
    "use_union_operator": True,
    "use_standard_collections": True,
    "use_schema_description": True,
    "use_field_description": True,
    "enum_field_as_literal": "all",
    "disable_timestamp": True,
    "custom_file_header": "# Generated from openapi/openapi.json. Do not edit.",
    "formatters": [Formatter.RUFF_CHECK, Formatter.RUFF_FORMAT],
}

generate(
    SPEC,
    output=OUT / "models.py",
    output_model_type=DataModelType.PydanticV2BaseModel,
    use_annotated=True,
    field_constraints=True,
    **COMMON,
)
generate(
    SPEC,
    output=OUT / "params.py",
    output_model_type=DataModelType.TypingTypedDict,
    **COMMON,
)
print(f"Wrote {OUT / 'models.py'} and {OUT / 'params.py'}")
