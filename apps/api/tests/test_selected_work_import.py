from app.photos.import_selected_work import catalog_metadata, fill_missing
from app.photos.record import CatalogRecord


def test_catalog_composed_location_is_not_lost():
    record = CatalogRecord().model_dump()
    record["location"]["display"]["zh"] = "哈尔滨南站，哈尔滨市，中国"
    record["time"] = "12:30"
    imported = catalog_metadata(record)
    assert imported["location"]["place"]["zh"] == record["location"]["display"]["zh"]
    assert imported["location"]["display"]["zh"] == record["location"]["display"]["zh"]
    assert imported["time"] == "12:30:00"
    assert imported["series"]["slug"] == "selected-work"
    assert record["location"]["place"]["zh"] == ""


def test_fill_missing_preserves_admin_changes_and_zero():
    current = {"title": {"zh": "后台改过的标题", "en": ""}, "order": 0, "iso": ""}
    incoming = {"title": {"zh": "旧目录标题", "en": "Title"}, "order": 9, "iso": 100}
    merged = fill_missing(current, incoming)
    assert merged == {"title": {"zh": "后台改过的标题", "en": "Title"}, "order": 0, "iso": 100}
    assert current["iso"] == ""
